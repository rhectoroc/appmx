import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static'; 
import { createHonoServer } from 'react-router-hono-server/node';
import { API_BASENAME, api } from './route-builder';
import fs from 'node:fs';
import path from 'node:path';

const app = new Hono();

// 1. Servir archivos estáticos del frontend
// Usamos rutas absolutas para evitar errores de "File not found" en Docker
const CLIENT_BUILD_PATH = path.join(process.cwd(), 'build/client');

app.use('/assets/*', serveStatic({ root: CLIENT_BUILD_PATH }));
app.use('/favicon.ico', serveStatic({ path: path.join(CLIENT_BUILD_PATH, 'favicon.ico') }));

// 2. Rutas de API Backend
// Hono procesará estas primero. Si una ruta coincide con /api/..., se queda aquí.
app.route(API_BASENAME, api);

// Cache para el motor de React Router
let routerHandler: any = null;

/**
 * 3. Integración con React Router (Manejador Universal)
 * Usamos .all("*") al final para que cualquier ruta que NO sea de la API 
 * sea capturada por el motor de renderizado de React Router.
 */
app.all("*", async (c) => {
  try {
    if (!routerHandler) {
      // Detectamos la ubicación del build del servidor
      const buildPath = path.join(process.cwd(), 'build/server/index.js');

      if (!fs.existsSync(buildPath)) {
        console.error("❌ ERROR: No se encontró build/server/index.js");
        return c.text("El motor de la aplicación no está listo. Verifica el Build.", 500);
      }

      console.log(`🚀 MotorX cargando SSR desde: ${buildPath}`);
      
      // Importación dinámica del build generado por Vite/React-Router
      // @ts-ignore
      const build = await import(/* @vite-ignore */ buildPath);
      routerHandler = await createHonoServer({ build } as any);
    }
    
    // IMPORTANTE: Le pasamos la petición original al manejador de React Router
    return await routerHandler.fetch(c.req.raw, { 
        ...((c.env || {}) as any),
        requestId: (c as any).get?.('requestId') 
    });
  } catch (e) {
    console.error("🔥 Error crítico en el flujo de la App:", e);
    return c.text("Sincronizando el motor de la aplicación...", 503);
  }
});

const port = Number(process.env.PORT) || 4001;

// Exportación para Bun
export default {
  port: port,
  fetch: app.fetch,
  hostname: '0.0.0.0'
};

console.log(`✅ Servidor MotorX listo en puerto: ${port}`);