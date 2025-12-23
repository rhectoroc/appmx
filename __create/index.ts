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

// 3. Integración con React Router sin chocar puertos
app.use("*", async (c) => {
  try {
    const BUILD_PATH = "/app/build/server/index.js";
    // @ts-ignore
    const build = await import(/* @vite-ignore */ BUILD_PATH);
    
    // Obtenemos solo el manejador, no un servidor nuevo
    const router: any = await createHonoServer({ build } as any);
    
    return router.fetch(c.req.raw, { 
        ...((c.env || {}) as any),
        requestId: (c as any).get?.('requestId') 
    });
  } catch (e) {
    console.error("Error cargando componentes:", e);
    return c.text("Cargando componentes de la aplicación...", 503);
  }
});

// SOLO un Bun.serve al final
const port = Number(process.env.PORT) || 4001;
console.log(`🚀 MotorX centralizado en puerto: ${port}`);

export default {
  port: port,
  fetch: app.fetch,
  hostname: '0.0.0.0'
};