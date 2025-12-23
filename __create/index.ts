import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static'; 
import { createHonoServer } from 'react-router-hono-server/node';
import { API_BASENAME, api } from './route-builder';
import fs from 'node:fs';
import path from 'node:path';

const app = new Hono();

// Middleware de logging para debugging
app.use('*', async (c, next) => {
  console.log(`📥 [${c.req.method}] ${c.req.url}`);
  await next();
  console.log(`📤 [${c.req.method}] ${c.req.url} - Status: ${c.res.status}`);
});

// 1. Verifica que existan los archivos estáticos
const CLIENT_PATH = path.join(process.cwd(), 'build/client');
const SERVER_PATH = path.join(process.cwd(), 'build/server');

console.log('📁 Client path:', CLIENT_PATH);
console.log('📁 Server path:', SERVER_PATH);
console.log('📁 Client exists:', fs.existsSync(CLIENT_PATH));
console.log('📁 Server exists:', fs.existsSync(SERVER_PATH));

// Solo servir estáticos si existen
if (fs.existsSync(CLIENT_PATH)) {
  app.use('/assets/*', serveStatic({ 
    root: CLIENT_PATH,
    onNotFound: (path) => console.log(`❌ Static file not found: ${path}`)
  }));
  
  app.use('/favicon.ico', serveStatic({ 
    path: path.join(CLIENT_PATH, 'favicon.ico'),
    onNotFound: () => console.log('❌ Favicon not found')
  }));
} else {
  console.log('⚠️  Client build not found, skipping static files');
}

// 2. Rutas de API
app.route(API_BASENAME, api);

let routerHandler: any = null;

// 3. Handler universal para React Router
app.all('*', async (c) => {
  try {
    console.log(`🚀 Handling route: ${c.req.path}`);
    
    if (!routerHandler) {
      const buildPath = path.join(SERVER_PATH, 'index.js');
      console.log(`📦 Loading server build from: ${buildPath}`);
      
      if (!fs.existsSync(buildPath)) {
        console.error(`❌ Server build not found at: ${buildPath}`);
        console.log('⚠️  Did you run `npm run build`?');
        return c.text("Server build not found. Please build the application first.", 500);
      }

      try {
        // @ts-ignore
        const build = await import(/* @vite-ignore */ `file://${buildPath}`);
        console.log('✅ Server build loaded successfully');
        routerHandler = await createHonoServer({ build });
        console.log('✅ React Router handler initialized');
      } catch (importError) {
        console.error('❌ Failed to import server build:', importError);
        return c.text("Failed to load server build.", 500);
      }
    }
    
    // Pasar el contexto correctamente a React Router
    return await routerHandler.fetch(c.req.raw, {
      ...(c.env || {}),
      requestContext: c,
    });
    
  } catch (e) {
    console.error("🔥 Error en SSR:", e);
    return c.text("Internal Server Error", 500);
  }
});

// Configuración del servidor
const port = Number(process.env.PORT) || 4001;
console.log(`🌍 Server starting on port ${port}...`);

export default {
  port: port,
  fetch: app.fetch,
  hostname: '0.0.0.0'
};