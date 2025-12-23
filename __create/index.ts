import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static'; 
import { createHonoServer } from 'react-router-hono-server/node';
import { API_BASENAME, api } from './route-builder';
import fs from 'node:fs';

const app = new Hono();

// 1. Servir archivos estáticos del frontend (Prioridad alta)
app.use('/assets/*', serveStatic({ root: './build/client' }));
app.use('/favicon.ico', serveStatic({ path: './build/client/favicon.ico' }));

// 2. Rutas de API Backend
app.route(API_BASENAME, api);

// Cache para el motor de React Router
let routerHandler: any = null;

// 3. Integración con React Router con Auto-Detección
app.use("*", async (c) => {
  try {
    if (!routerHandler) {
      // Intentamos detectar la ruta real en el contenedor
      const pathsToTry = [
        "/app/build/server/index.js",
        "./build/server/index.js"
      ];
      
      let buildPath = "";
      for (const p of pathsToTry) {
        if (fs.existsSync(p)) {
          buildPath = p;
          break;
        }
      }

      if (!buildPath) {
        console.error("❌ Error: No se encontró build/server/index.js");
        return c.text("Error interno: Build no encontrado", 500);
      }

      console.log(`🚀 MotorX cargando SSR desde: ${buildPath}`);
      
      // @ts-ignore
      const build = await import(/* @vite-ignore */ buildPath);
      routerHandler = await createHonoServer({ build } as any);
    }
    
    // Ejecutar el renderizado de la web
    return routerHandler.fetch(c.req.raw, { 
        ...((c.env || {}) as any),
        requestId: (c as any).get?.('requestId') 
    });
  } catch (e) {
    console.error("🔥 Error en el flujo de la App:", e);
    return c.text("Sincronizando el motor de la aplicación...", 503);
  }
});

const port = Number(process.env.PORT) || 4001;
console.log(`✅ Servidor MotorX listo en puerto: ${port}`);

// Exportación requerida por Bun
export default {
  port: port,
  fetch: app.fetch,
  hostname: '0.0.0.0'
};