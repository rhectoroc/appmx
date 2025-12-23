import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static'; 
import { createHonoServer } from 'react-router-hono-server/node';
import { API_BASENAME, api } from './route-builder';

const app = new Hono();

// 1. Servir archivos estáticos directamente
app.use('/assets/*', serveStatic({ root: './build/client' }));
app.use('/favicon.ico', serveStatic({ path: './build/client/favicon.ico' }));

// 2. Rutas de API
app.route(API_BASENAME, api);

// 3. Carga dinámica de React Router como middleware
app.use("*", async (c, next) => {
  try {
    const BUILD_PATH = "/app/build/server/index.js";
    // @ts-ignore
    const build = await import(/* @vite-ignore */ BUILD_PATH);
    
    // Obtenemos la instancia del servidor de React Router
    // Usamos 'as any' para evitar conflictos de tipos en el build
    const routerServer: any = await createHonoServer({ build } as any);
    
    // Ejecutamos solo el fetch del router, pasando el contexto actual
    return routerServer.fetch(c.req.raw, { 
        ...((c.env || {}) as any),
        requestId: (c as any).get?.('requestId') 
    });
  } catch (e) {
    console.error("Error en el motor de renderizado:", e);
    return c.text("El motor de la aplicación se está iniciando...", 503);
  }
});

const port = Number(process.env.PORT) || 4001;
console.log(`🚀 MotorX centralizado en puerto: ${port}`);

export default {
  port: port,
  fetch: app.fetch,
  hostname: '0.0.0.0'
};