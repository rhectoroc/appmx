import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static'; 
import { createHonoServer } from 'react-router-hono-server/node';
import { API_BASENAME, api } from './route-builder';
import fs from 'node:fs';
import path from 'node:path';

const app = new Hono();
app.get('/test', (c) => c.text('Hono está funcionando perfectamente'));

// 1. Servir archivos estáticos (IMPORTANTE: Usar rutas absolutas en Docker)
const CLIENT_PATH = path.join(process.cwd(), 'build/client');

app.use('/assets/*', serveStatic({ root: CLIENT_PATH }));
app.use('/favicon.ico', serveStatic({ path: path.join(CLIENT_PATH, 'favicon.ico') }));

// 2. Rutas de API Backend
app.route(API_BASENAME, api);

let routerHandler: any = null;

// 3. CAPTURADOR UNIVERSAL (Cambiado de .use a .all)
app.all("*", async (c) => {
  // Si la ruta empieza por /api, Hono ya la manejó arriba. Si llega aquí, es para React.
  try {
    if (!routerHandler) {
      const buildPath = path.join(process.cwd(), 'build/server/index.js');
      
      if (!fs.existsSync(buildPath)) {
        console.error("❌ ERROR CRÍTICO: No existe build/server/index.js");
        return c.text("Build no encontrado. Ejecuta 'npm run build' primero.", 500);
      }

      console.log(`🚀 MotorX cargando SSR desde: ${buildPath}`);
      // @ts-ignore
      const build = await import(/* @vite-ignore */ buildPath);
      routerHandler = await createHonoServer({ build } as any);
    }
    
    // Pasamos el control a React Router
    return await routerHandler.fetch(c.req.raw, { 
        ...((c.env || {}) as any),
        requestId: (c as any).get?.('requestId') 
    });
  } catch (e) {
    console.error("🔥 Error en el motor de React:", e);
    return c.text("Error interno del servidor", 500);
  }
});

const port = Number(process.env.PORT) || 4001;
console.log(`✅ Servidor MotorX listo en puerto: ${port}`);

export default {
  port: port,
  fetch: app.fetch,
  hostname: '0.0.0.0'
};