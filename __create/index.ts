import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static'; 
import { createHonoServer } from 'react-router-hono-server/node';
import { API_BASENAME, api } from './route-builder';
import fs from 'node:fs';
import path from 'node:path';

const app = new Hono();

// 1. Estáticos (Prioridad máxima)
const CLIENT_PATH = path.join(process.cwd(), 'build/client');
app.use('/assets/*', serveStatic({ root: CLIENT_PATH }));
app.use('/favicon.ico', serveStatic({ path: path.join(CLIENT_PATH, 'favicon.ico') }));

// 2. API
app.route(API_BASENAME, api);

let routerHandler: any = null;

// 3. Manejador Universal para React Router
app.all("*", async (c) => {
  try {
    if (!routerHandler) {
      const buildPath = path.join(process.cwd(), 'build/server/index.js');
      if (!fs.existsSync(buildPath)) {
        return c.text("Build no encontrado", 500);
      }
      
      const build = await import(/* @vite-ignore */ buildPath);
      // Solo creamos el servidor de React Router, no lo iniciamos nosotros
      routerHandler = await createHonoServer({ build } as any);
    }
    
    // Devolvemos la respuesta del motor de React
    return await routerHandler.fetch(c.req.raw, { 
        ...((c.env || {}) as any),
        requestId: (c as any).get?.('requestId') 
    });
  } catch (e) {
    console.error("🔥 Error SSR:", e);
    return c.text("Error en el motor visual", 500);
  }
});

// --- ELIMINAMOS EL console.log DE ABAJO Y USAMOS SOLO EL EXPORT ---
const port = Number(process.env.PORT) || 4001;

export default {
  port: port,
  fetch: app.fetch,
  hostname: '0.0.0.0'
};