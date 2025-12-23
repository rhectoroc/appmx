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

app.use('*', requestId());
app.use('*', (c, next) => {
  const rid = c.get('requestId');
  return als.run({ requestId: rid }, () => next());
});
app.use(contextStorage());

app.use('/assets/*', serveStatic({ root: './build/client' }));
app.use('/favicon.ico', serveStatic({ path: './build/client/favicon.ico' }));

app.use('*', initAuthConfig((c) => ({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  pages: { signIn: '/account/signin', signOut: '/account/logout', error: '/account/error' },
  skipCSRFCheck,
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      id: 'credentials-signin',
      authorize: async (creds) => {
        const user = await adapter.getUserByEmail(creds.email as string);
        if (!user) return null;
        const acc = user.accounts?.find(a => a.provider === 'credentials');
        if (!acc?.password) return null;
        const isValid = await verify(acc.password, creds.password as string);
        return isValid ? user : null;
      },
    }),
  ],
})));

app.use('/api/auth/*', authHandler());
app.route(API_BASENAME, api);

// --- Manejador Dinámico Final sin errores de Spread ---
app.use("*", async (c, next) => {
  try {
    const BUILD_PATH = "/app/build/server/index.js";
    
    // @ts-ignore
    const build = await import(/* @vite-ignore */ BUILD_PATH);
    
    // Obtenemos el servidor y lo tratamos como any
    const server: any = await createHonoServer({ build } as any);
    
    // CORRECCIÓN: Forzamos c.env a Record<string, any> para evitar el error de Spread
    const env = (c.env || {}) as Record<string, any>;
    
    return server.fetch(c.req.raw, { 
        ...env, 
        requestId: c.get('requestId') 
    });
  } catch (e) {
    console.error("Error crítico cargando build:", e);
    return c.text("Error en la carga del servidor...", 503);
  }
});

app.onError((err, c) => {
  console.error("Server Error:", err);
  return c.req.method !== 'GET' 
    ? c.json({ error: 'App Error', details: serializeError(err) }, 500)
    : c.html(getHTMLForErrorPage(err), 200);
});

const port = Number(process.env.PORT) || 4001;
export default {
  port: port,
  fetch: app.fetch,
  hostname: '0.0.0.0'
};