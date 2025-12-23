import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static'; 
import { createHonoServer } from 'react-router-hono-server/node';
import { API_BASENAME, api } from './route-builder';
import fs from 'node:fs';
import path from 'node:path';

const app = new Hono();

// 1. Servir archivos estáticos del frontend
// Usamos path.join para asegurar que encuentre la ruta subiendo un nivel desde __create
const CLIENT_BUILD_PATH = path.join(process.cwd(), 'build/client');

app.use('/assets/*', serveStatic({ root: CLIENT_BUILD_PATH }));
app.use('/favicon.ico', serveStatic({ path: path.join(CLIENT_BUILD_PATH, 'favicon.ico') }));

// 2. Rutas de API Backend (Importadas desde route-builder.ts en la misma carpeta)
app.route(API_BASENAME, api);

// Cache para el motor de React Router
let routerHandler: any = null;

// 3. Integración con React Router con Auto-Detección de ruta del Build
app.use("*", async (c) => {
  try {
    if (!routerHandler) {
      // Rutas a probar: absoluta de Docker y relativa subiendo desde __create
      const pathsToTry = [
        "/app/build/server/index.js",
        path.join(process.cwd(), 'build/server/index.js')
      ];
      
      let buildPath = "";
      for (const p of pathsToTry) {
        if (fs.existsSync(p)) {
          buildPath = p;
          break;
        }
      }

      if (!buildPath) {
        console.error("❌ Error: No se encontró build/server/index.js. Verifica el comando build.");
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
    console.error("🔥 Error en el flujo de renderizado:", e);
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