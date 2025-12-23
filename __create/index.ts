import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static'; 
import { createHonoServer } from 'react-router-hono-server/node';
import { API_BASENAME, api } from './route-builder';
import fs from 'node:fs';
import path from 'node:path';

const app = new Hono();

// 1. Estáticos (Rutas absolutas para Docker)
const CLIENT_PATH = path.join(process.cwd(), 'build/client');
app.use('/assets/*', serveStatic({ root: CLIENT_PATH }));
app.use('/favicon.ico', serveStatic({ path: path.join(CLIENT_PATH, 'favicon.ico') }));

// 2. Rutas de API
app.route(API_BASENAME, api);

let routerHandler: any = null;

// 3. Capturador Universal
// Cambiamos .use por .all para asegurar que React Router maneje cualquier método
app.all("*", async (c) => {
  try {
    if (!routerHandler) {
      const buildPath = path.join(process.cwd(), 'build/server/index.js');
      
      if (!fs.existsSync(buildPath)) {
        return c.text("Error: Build de servidor no encontrado.", 500);
      }

      // @ts-ignore
      const build = await import(/* @vite-ignore */ buildPath);
      routerHandler = await createHonoServer({ build } as any);
    }
    
    // Devolvemos el resultado del motor de React Router directamente
    return await routerHandler.fetch(c.req.raw, { 
        ...((c.env || {}) as any),
        requestId: (c as any).get?.('requestId') 
    });
  } catch (e) {
    console.error("🔥 Error SSR:", e);
    return c.text("Error cargando la aplicación visual", 500);
  }
});

// EXPORTACIÓN PARA BUN (Sin abrir puerto manualmente con app.listen)
const port = Number(process.env.PORT) || 4001;

export default {
  port: port,
  fetch: app.fetch,
  hostname: '0.0.0.0'
};