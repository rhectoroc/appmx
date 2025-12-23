import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static'; 
import { createHonoServer } from 'react-router-hono-server/node';
import { API_BASENAME, api } from './route-builder';
import fs from 'node:fs';
import path from 'node:path';

const app = new Hono();

// --- FUNCIÓN DE DIAGNÓSTICO ---
const findBuildPath = () => {
  const possiblePaths = [
    '/app/build/server/index.js',
    './build/server/index.js',
    path.join(process.cwd(), 'build/server/index.js')
  ];

  console.log("🔍 Escaneando entorno de archivos...");
  console.log("Directorio actual (cwd):", process.cwd());

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`✅ Build encontrado en: ${p}`);
      return p;
    }
    console.log(`❌ No encontrado en: ${p}`);
  }
  return null;
};

// 1. Servir archivos estáticos del frontend
app.use('/assets/*', serveStatic({ root: './build/client' }));
app.use('/favicon.ico', serveStatic({ path: './build/client/favicon.ico' }));

// 2. Rutas de API
app.route(API_BASENAME, api);

let routerHandler: any = null;
const detectedPath = findBuildPath();

// 3. Integración con React Router
app.use("*", async (c) => {
  try {
    if (!detectedPath) {
      return c.text("Error: No se encontró el build del servidor. Revisa los logs de inicio.", 500);
    }

    if (!routerHandler) {
      // @ts-ignore
      const build = await import(/* @vite-ignore */ detectedPath);
      routerHandler = await createHonoServer({ build } as any);
    }
    
    return routerHandler.fetch(c.req.raw, { 
        ...((c.env || {}) as any),
        requestId: (c as any).get?.('requestId') 
    });
  } catch (e) {
    console.error("🔥 Error crítico en ejecución:", e);
    return c.text("Error cargando componentes...", 503);
  }
});

const port = Number(process.env.PORT) || 4001;
console.log(`🚀 MotorX centralizado en puerto: ${port}`);

export default {
  port: port,
  fetch: app.fetch,
  hostname: '0.0.0.0'
};