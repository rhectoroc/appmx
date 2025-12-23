import { AsyncLocalStorage } from 'node:async_hooks';
import nodeConsole from 'node:console';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static'; 
import { createHonoServer } from 'react-router-hono-server/node';
import pg from 'pg';
import NeonAdapter from './adapter';
import { API_BASENAME, api } from './route-builder';

const app = new Hono();

// --- 1. Servir estáticos PRIMERO para evitar que pasen por React Router ---
app.use('/assets/*', serveStatic({ root: './build/client' }));
app.use('/favicon.ico', serveStatic({ path: './build/client/favicon.ico' }));

// --- 2. Tus rutas de API (Backend) ---
app.route(API_BASENAME, api);

// --- 3. El cargador dinámico de la App ---
app.use("*", async (c, next) => {
  try {
    // IMPORTANTE: Ruta absoluta para Docker
    const BUILD_PATH = "/app/build/server/index.js";
    // @ts-ignore
    const build = await import(/* @vite-ignore */ BUILD_PATH);
    
    // Solo creamos el servidor si no existe uno ya
    const server: any = await createHonoServer({ build } as any);
    
    // Pasamos el control a React Router
    return server.fetch(c.req.raw, { 
        ...((c.env || {}) as any),
        requestId: (c as any).get?.('requestId') 
    });
  } catch (e) {
    console.error("Error en SSR:", e);
    return c.text("Iniciando motor...", 503);
  }
});

const port = Number(process.env.PORT) || 4001;

// EXPORTACIÓN PARA BUN
export default {
  port: port,
  fetch: app.fetch,
  hostname: '0.0.0.0'
};