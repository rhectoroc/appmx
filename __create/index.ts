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
import { serveStatic } from '@hono/node-server/serve-static'; // IMPORTANTE
import { serializeError } from 'serialize-error';
import NeonAdapter from './adapter';
import { getHTMLForErrorPage } from './get-html-for-error-page';
import { isAuthAction } from './is-auth-action';
import { API_BASENAME, api } from './route-builder';

const { Pool } = pg;
const als = new AsyncLocalStorage<{ requestId: string }>();

// --- Logs ---
for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
  const original = nodeConsole[method].bind(console);
  console[method] = (...args: unknown[]) => {
    const requestId = als.getStore()?.requestId;
    requestId ? original(`[traceId:${requestId}]`, ...args) : original(...args);
  };
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = NeonAdapter(pool as any);
const app = new Hono();

// --- Middleware Inicial ---
app.use('*', requestId());
app.use('*', (c, next) => {
  const rid = c.get('requestId');
  return als.run({ requestId: rid }, () => next());
});
app.use(contextStorage());

// --- SOLUCIÓN AL ERROR DE ASSETS: Servir archivos estáticos ---
// Esto evita que 'build.publicPath' sea undefined en el servidor
app.use('/assets/*', serveStatic({ root: './build/client' }));
app.use('/favicon.ico', serveStatic({ path: './build/client/favicon.ico' }));

// --- Manejo de Errores ---
app.onError((err, c) => {
  console.error("Server Error:", err);
  return c.req.method !== 'GET' 
    ? c.json({ error: 'App Error', details: serializeError(err) }, 500)
    : c.html(getHTMLForErrorPage(err), 200);
});

// --- CORS y Seguridad ---
if (process.env.CORS_ORIGINS) {
  app.use('/*', cors({ origin: process.env.CORS_ORIGINS.split(',').map(o => o.trim()) }));
}

app.use('*', bodyLimit({
  maxSize: 4.5 * 1024 * 1024,
  onError: (c) => c.json({ error: 'Body size limit exceeded' }, 413),
}));

// --- Auth ---
if (process.env.AUTH_SECRET) {
  app.use('*', initAuthConfig((c) => ({
    secret: process.env.AUTH_SECRET,
    pages: { signIn: '/account/signin', signOut: '/account/logout' },
    skipCSRFCheck,
    session: { strategy: 'jwt' },
    providers: [
      Credentials({
        id: 'credentials-signin',
        authorize: async (creds) => {
          const user = await adapter.getUserByEmail(creds.email as string);
          if (!user) return null;
          const acc = user.accounts.find(a => a.provider === 'credentials');
          if (!acc?.password) return null;
          return (await verify(acc.password, creds.password as string)) ? user : null;
        },
      }),
      Credentials({
        id: 'credentials-signup',
        authorize: async (creds) => {
          const user = await adapter.getUserByEmail(creds.email as string);
          if (user) return null;
          const newUser = await adapter.createUser({
            id: crypto.randomUUID(),
            email: creds.email as string,
            name: creds.name as string,
            image: creds.image as string,
            emailVerified: null,
          });
          await adapter.linkAccount({
            extraData: { password: await hash(creds.password as string) },
            type: 'credentials',
            userId: newUser.id,
            providerAccountId: newUser.id,
            provider: 'credentials',
          });
          return newUser;
        },
      }),
    ],
  })));
}

// --- Rutas y Proxies ---
app.use('/api/auth/*', async (c, next) => {
  if (isAuthAction(c.req.path)) return authHandler()(c, next);
  return next();
});

app.route(API_BASENAME, api);

// --- Servidor ---
export default await createHonoServer({
  app,
  defaultLogger: false,
});