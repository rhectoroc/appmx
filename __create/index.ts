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
import { bodyLimit } from 'hono/body-limit';
import { requestId } from 'hono/request-id';
import { createHonoServer } from 'react-router-hono-server/node';
import { serveStatic } from '@hono/node-server/serve-static'; 
import { serializeError } from 'serialize-error';
import NeonAdapter from './adapter';
import { getHTMLForErrorPage } from './get-html-for-error-page';
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

// Configuración de Pool robusta para Docker/Easypanel
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Si usas SSL en Neon, descomenta esto; si es base de datos local de Easypanel, déjalo así.
  // ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false 
});

const adapter = NeonAdapter(pool as any);
const app = new Hono();

// --- Middleware Inicial ---
app.use('*', requestId());
app.use('*', (c, next) => {
  const rid = c.get('requestId');
  return als.run({ requestId: rid }, () => next());
});
app.use(contextStorage());

// --- Servir archivos estáticos ---
app.use('/assets/*', serveStatic({ root: './build/client' }));
app.use('/favicon.ico', serveStatic({ path: './build/client/favicon.ico' }));

// --- Manejo de Errores ---
app.onError((err, c) => {
  console.error("Server Error:", err);
  return c.req.method !== 'GET' 
    ? c.json({ error: 'App Error', details: serializeError(err) }, 500)
    : c.html(getHTMLForErrorPage(err), 200);
});

// --- CORS ---
if (process.env.CORS_ORIGINS) {
  app.use('/*', cors({ origin: process.env.CORS_ORIGINS.split(',').map(o => o.trim()) }));
}

app.use('*', bodyLimit({
  maxSize: 4.5 * 1024 * 1024,
  onError: (c) => c.json({ error: 'Body size limit exceeded' }, 413),
}));

// --- Auth Configuration ---
app.use('*', initAuthConfig((c) => ({
  secret: process.env.AUTH_SECRET,
  trustHost: true, // CRÍTICO para Easypanel/Proxies
  pages: { 
    signIn: '/account/signin', 
    signOut: '/account/logout',
    error: '/account/error' 
  },
  skipCSRFCheck,
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      id: 'credentials-signin',
      name: 'Credentials',
      authorize: async (creds) => {
        const user = await adapter.getUserByEmail(creds.email as string);
        if (!user) return null;
        const acc = user.accounts?.find(a => a.provider === 'credentials');
        if (!acc?.password) return null;
        const isValid = await verify(acc.password, creds.password as string);
        return isValid ? user : null;
      },
    }),
    Credentials({
      id: 'credentials-signup',
      authorize: async (creds) => {
        const user = await adapter.getUserByEmail(creds.email as string);
        if (user) throw new Error("User already exists");
        
        const newUser = await adapter.createUser({
          id: crypto.randomUUID(),
          email: creds.email as string,
          name: creds.name as string,
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

// --- Rutas de Auth ---
// Simplificado para evitar el error UnknownAction
app.use('/api/auth/*', authHandler());

app.route(API_BASENAME, api);

// --- Inicio del Servidor ---
const port = Number(process.env.PORT) || 4001;

export default await createHonoServer({
  app,
  port: port,
  defaultLogger: false,
});