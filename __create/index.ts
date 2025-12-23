// __create/index.ts - VERSIÓN FINAL CORRECTA
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static'; 
import { createHonoServer } from 'react-router-hono-server/node';
import { API_BASENAME, api } from './route-builder'; // <-- ✅ Import desde mismo dir
import fs from 'node:fs';
import path from 'node:path';

const app = new Hono();

// === 1. LOGGING MIDDLEWARE ===
app.use('*', async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const url = c.req.url;
  console.log(`📥 [${method}] ${url}`);
  await next();
  const ms = Date.now() - start;
  const status = c.res.status;
  const emoji = status >= 500 ? '🔥' : status >= 400 ? '⚠️' : '✅';
  console.log(`${emoji} [${method}] ${url} - ${status} (${ms}ms)`);
});

// === 2. HEALTH CHECK (siempre funciona) ===
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok',
    service: 'main-server',
    timestamp: new Date().toISOString(),
    runtime: 'Bun',
    nodeEnv: process.env.NODE_ENV || 'development',
    cwd: process.cwd()
  });
});

// === 3. DEBUG ENDPOINT (para verificar estructura) ===
app.get('/debug', (c) => {
  const buildPath = path.join(process.cwd(), 'build');
  const buildExists = fs.existsSync(buildPath);
  
  let info = {
    cwd: process.cwd(),
    dirContents: fs.readdirSync(process.cwd()),
    buildExists,
    buildContents: buildExists ? fs.readdirSync(buildPath) : [],
    __createContents: fs.readdirSync(path.join(process.cwd(), '__create')),
    hasRouteBuilder: fs.existsSync(path.join(process.cwd(), '__create/route-builder.ts'))
  };
  
  return c.json(info);
});

// === 4. SERVIR ARCHIVOS ESTÁTICOS ===
const CLIENT_BUILD_DIR = path.join(process.cwd(), 'build/client');
console.log(`📁 Checking client build at: ${CLIENT_BUILD_DIR}`);

if (fs.existsSync(CLIENT_BUILD_DIR)) {
  console.log('✅ Serving static files from build/client');
  
  // Servir assets
  app.use('/assets/*', serveStatic({ 
    root: CLIENT_BUILD_DIR,
    rewriteRequestPath: (p) => p
  }));
  
  // Servir favicon
  const faviconPath = path.join(CLIENT_BUILD_DIR, 'favicon.ico');
  if (fs.existsSync(faviconPath)) {
    app.use('/favicon.ico', serveStatic({ path: faviconPath }));
  }
  
  // Servir otros archivos estáticos comunes
  app.use('/*.(ico|png|jpg|svg|css|js|txt)', serveStatic({ 
    root: CLIENT_BUILD_DIR,
    rewriteRequestPath: (p) => p.startsWith('/') ? p.slice(1) : p
  }));
} else {
  console.warn(`⚠️ Client build not found at: ${CLIENT_BUILD_DIR}`);
  console.warn(`⚠️ Make sure to run: bun run build`);
  
  // Fallback para desarrollo
  app.use('/assets/*', (c) => {
    return c.text(`Static file not found. Build required.`, 404);
  });
}

// === 5. REGISTRAR RUTAS API ===
console.log(`🔄 Registering API routes at: ${API_BASENAME}`);
app.route(API_BASENAME, api);

// === 6. REACT ROUTER HANDLER ===
let reactRouterHandler: any = null;

const initializeReactRouter = async () => {
  try {
    const SERVER_BUILD_PATH = path.join(process.cwd(), 'build/server/index.js');
    console.log(`🔍 Looking for React Router build at: ${SERVER_BUILD_PATH}`);
    
    if (!fs.existsSync(SERVER_BUILD_PATH)) {
      throw new Error(`Server build not found at: ${SERVER_BUILD_PATH}`);
    }
    
    console.log('✅ Server build found, importing...');
    const build = await import(SERVER_BUILD_PATH);
    console.log('✅ Server build imported successfully');
    
    reactRouterHandler = await createHonoServer({ build });
    console.log('✅ React Router handler initialized');
    
    return true;
  } catch (error: any) {
    console.error('❌ Failed to initialize React Router:', error.message);
    throw error;
  }
};

// === 7. CATCH-ALL PARA REACT ROUTER ===
app.all('*', async (c) => {
  const requestPath = c.req.path;
  
  // Skip rutas ya manejadas
  if (
    requestPath === '/health' || 
    requestPath === '/debug' ||
    requestPath.startsWith('/api') || 
    requestPath.startsWith('/assets')
  ) {
    return c.text('Not Found', 404);
  }
  
  console.log(`🎯 Passing to React Router: ${requestPath}`);
  
  try {
    // Inicializar React Router si no está listo
    if (!reactRouterHandler) {
      console.log('🔄 Lazy initializing React Router...');
      await initializeReactRouter();
    }
    
    // Delegate to React Router
    const response = await reactRouterHandler.fetch(c.req.raw, {
      ...(c.env || {}),
      honoContext: c,
    });
    
    return response;
    
  } catch (error: any) {
    console.error(`🔥 Error in React Router for ${requestPath}:`, error.message);
    
    // Página de error amigable
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Application Error</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 2rem; line-height: 1.6; }
            .error { background: #fee; border-left: 4px solid #c33; padding: 1rem; margin: 1rem 0; }
            code { background: #f0f0f0; padding: 0.2rem 0.4rem; border-radius: 3px; }
          </style>
        </head>
        <body>
          <h1>Application Error</h1>
          <div class="error">
            <strong>Error:</strong> ${error.message}
          </div>
          <p>This usually means:</p>
          <ol>
            <li>The application needs to be built: <code>bun run build</code></li>
            <li>React Router is not properly configured</li>
            <li>There's a server-side rendering error</li>
          </ol>
          <p>Check the server logs for more details.</p>
          <p><a href="/health">Check server health</a> | <a href="/debug">View debug info</a></p>
        </body>
      </html>
    `, 500);
  }
});

// === 8. CONFIGURACIÓN DEL SERVIDOR ===
const port = Number(process.env.PORT) || 4001;

console.log(`
┌─────────────────────────────────────────────┐
│           🚀 SERVER STARTING                │
├─────────────────────────────────────────────┤
│ Port: ${port.toString().padEnd(30)} │
│ Host: 0.0.0.0${' '.padEnd(28)} │
│ CWD: ${process.cwd().substring(0, 30).padEnd(30)} │
│ Env: ${(process.env.NODE_ENV || 'development').padEnd(30)} │
└─────────────────────────────────────────────┘
`);

export default {
  port,
  fetch: app.fetch,
  hostname: '0.0.0.0'
};