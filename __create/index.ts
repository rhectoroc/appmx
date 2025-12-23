import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static'; 
import { API_BASENAME, api } from './route-builder';

// Creamos la app de Hono pero NO la iniciamos aquí
const app = new Hono();

// 1. Servir archivos estáticos
app.use('/assets/*', serveStatic({ root: './build/client' }));
app.use('/favicon.ico', serveStatic({ path: './build/client/favicon.ico' }));

// 2. Tus rutas de API (Backend)
app.route(API_BASENAME, api);

// Exportamos la app para que React Router la use como base
export default app;