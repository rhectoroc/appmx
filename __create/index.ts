import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static'; 
import { createHonoServer } from 'react-router-hono-server/node';
import { API_BASENAME, api } from './route-builder';

const app = new Hono();

// 1. Servir archivos estáticos del frontend
app.use('/assets/*', serveStatic({ root: './build/client' }));
app.use('/favicon.ico', serveStatic({ path: './build/client/favicon.ico' }));

// 2. Tus rutas de API (Backend)
app.route(API_BASENAME, api);

// --- MEJORA: Variable para cachear el router y evitar sobrecarga ---
let routerHandler: any = null;

// 3. Integración con React Router
app.use("*", async (c) => {
  try {
    if (!routerHandler) {
      const BUILD_PATH = "/app/build/server/index.js";
      // @ts-ignore
      const build = await import(/* @vite-ignore */ BUILD_PATH);
      
      // Creamos el servidor de React Router UNA SOLA VEZ
      routerHandler = await createHonoServer({ build } as any);
    }
    
    // Usamos el handler cacheado para procesar la petición
    return routerHandler.fetch(c.req.raw, { 
        ...((c.env || {}) as any),
        requestId: (c as any).get?.('requestId') 
    });
  } catch (e) {
    console.error("Error crítico en el motor de renderizado:", e);
    return c.text("Cargando componentes de la aplicación...", 503);
  }
});

const port = Number(process.env.PORT) || 4001;

// Exportación estándar para Bun
export default {
  port: port,
  fetch: app.fetch,
  hostname: '0.0.0.0'
};