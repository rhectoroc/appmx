import { AsyncLocalStorage } from 'node:async_hooks';
import nodeConsole from 'node:console';
import { skipCSRFCheck } from '@auth/core';
import Credentials from '@auth/core/providers/credentials';
import { authHandler, initAuthConfig } from '@hono/auth-js';
import pg from 'pg';
import { hash, verify } from 'argon2';
import { Hono } from 'hono';
import { contextStorage } from 'hono/context-storage';
import { cors } from 'hono/cors';
import { proxy } from 'hono/proxy';
import { bodyLimit } from 'hono/body-limit';
import { requestId } from 'hono/request-id';
import { createHonoServer } from 'react-router-hono-server/node';
import { serializeError } from 'serialize-error';
import NeonAdapter from './adapter'; // Aunque se llame NeonAdapter, ahora usa pg estándar
import { getHTMLForErrorPage } from './get-html-for-error-page';
import { isAuthAction } from './is-auth-action';
import { API_BASENAME, api } from './route-builder';

const { Pool } = pg;
const als = new AsyncLocalStorage<{ requestId: string }>();

// --- Sistema de Logs con Trace ID ---
for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
  const original = nodeConsole[method].bind(console);
  console[method] = (...args: unknown[]) => {
    const requestId = als.getStore()?.requestId;
    if (requestId) {
      original(`[traceId:${requestId}]`, ...args);
    } else {
      original(...args);
    }
  };
}

// --- Configuración de Base de Datos (Postgres Tradicional) ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Opcional: Descomentar si usas SSL en tu DB (común en servicios externos)
  // ssl: { rejectUnauthorized: false } 
});

// El adaptador ahora recibe el pool de 'pg'
const adapter = NeonAdapter(pool as any); 

const app = new Hono();

// --- Middleware Inicial ---
app.use('*', requestId());
app.use('*', (c, next) => {
  const requestId = c.get('requestId');
  return als.run({ requestId }, () => next());
});
app.use(contextStorage());

// --- Manejo de Errores ---
app.onError((err, c) => {
  console.error("Server Error:", err);
  if (c.req.method !== 'GET') {
    return c.json(
      {
        error: 'An error occurred in your app',
        details: serializeError(err),
      },
      500
    );
  }
  return c.html(getHTMLForErrorPage(err), 200);
});

// --- CORS y Límites ---
if (process.env.CORS_ORIGINS) {
  app.use(
    '/*',
    cors({
      origin: process.env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    })
  );
}

app.use(
  '*',
  bodyLimit({
    maxSize: 4.5 * 1024 * 1024,
    onError: (c) => c.json({ error: 'Body size limit exceeded' }, 413),
  })
);

// --- Configuración de Autenticación ---
if (process.env.AUTH_SECRET) {
  app.use(
    '*',
    initAuthConfig((c) => ({
      secret: process.env.AUTH_SECRET,
      pages: {
        signIn: '/account/signin',
        signOut: '/account/logout',
      },
      skipCSRFCheck,
      session: { strategy: 'jwt' },
      callbacks: {
        session({ session, token }) {
          if (token.sub && session.user) {
            session.user.id = token.sub;
          }
          return session;
        },
      },
      providers: [
        Credentials({
          id: 'credentials-signin',
          authorize: async (credentials) => {
            const { email, password } = credentials;
            if (!email || !password) return null;

            const user = await adapter.getUserByEmail(email as string);
            if (!user) return null;

            const matchingAccount = user.accounts.find(a => a.provider === 'credentials');
            if (!matchingAccount?.password) return null;

            const isValid = await verify(matchingAccount.password, password as string);
            return isValid ? user : null;
          },
        }),
        Credentials({
          id: 'credentials-signup',
          authorize: async (credentials) => {
            const { email, password, name, image } = credentials;
            if (!email || !password) return null;

            const user = await adapter.getUserByEmail(email as string);
            if (!user) {
              const newUser = await adapter.createUser({
                id: crypto.randomUUID(),
                email: email as string,
                name: name as string,
                image: image as string,
                emailVerified: null,
              });
              
              await adapter.linkAccount({
                extraData: { password: await hash(password as string) },
                type: 'credentials',
                userId: newUser.id,
                providerAccountId: newUser.id,
                provider: 'credentials',
              });
              return newUser;
            }
            return null;
          },
        }),
      ],
    }))
  );
}

// --- Integraciones y Auth Handler ---
app.all('/integrations/:path{.+}', async (c) => {
  const queryParams = c.req.query();
  const url = `${process.env.NEXT_PUBLIC_CREATE_BASE_URL ?? 'https://www.create.xyz'}/integrations/${c.req.param('path')}${Object.keys(queryParams).length > 0 ? `?${new URLSearchParams(queryParams).toString()}` : ''}`;

  return proxy(url, {
    method: c.req.method,
    body: c.req.raw.body ?? null,
    duplex: 'half',
    redirect: 'manual',
    headers: {
      ...c.req.header(),
      'X-Forwarded-For': process.env.NEXT_PUBLIC_CREATE_HOST || '',
      'x-createxyz-host': process.env.NEXT_PUBLIC_CREATE_HOST || '',
      Host: process.env.NEXT_PUBLIC_CREATE_HOST || '',
    },
  });
});

app.use('/api/auth/*', async (c, next) => {
  if (isAuthAction(c.req.path)) {
    return authHandler()(c, next);
  }
  return next();
});

// --- Registro de Rutas API ---
app.route(API_BASENAME, api);

// --- Inicio del Servidor ---
export default await createHonoServer({
  app,
  defaultLogger: false,
});