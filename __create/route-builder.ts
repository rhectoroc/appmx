import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import type { Handler } from 'hono/types';
import updatedFetch from '../src/__create/fetch';
import { existsSync } from 'node:fs'; // Añadimos esto para validación rápida

const API_BASENAME = '/api';
const api = new Hono();

// Cambiamos la lógica de __dirname para que funcione en Docker/Producción
const __dirname = join(process.cwd(), 'src/app/api');

if (globalThis.fetch) {
  globalThis.fetch = updatedFetch;
}

async function findRouteFiles(dir: string): Promise<string[]> {
  // VALIDACIÓN: Si el directorio no existe, retornamos vacío en lugar de lanzar error
  if (!existsSync(dir)) {
    console.warn(`Directorio de API no encontrado en: ${dir}. Saltando registro de rutas.`);
    return [];
  }

  const files = await readdir(dir);
  let routes: string[] = [];

  for (const file of files) {
    try {
      const filePath = join(dir, file);
      const statResult = await stat(filePath);

      if (statResult.isDirectory()) {
        routes = routes.concat(await findRouteFiles(filePath));
      } else if (file === 'route.js' || file === 'route.ts') { // Soporte para .ts
        if (filePath === join(__dirname, 'route.js') || filePath === join(__dirname, 'route.ts')) {
          routes.unshift(filePath);
        } else {
          routes.push(filePath);
        }
      }
    } catch (error) {
      console.error(`Error reading file ${file}:`, error);
    }
  }
  return routes;
}

// ... (getHonoPath se mantiene igual)

async function registerRoutes() {
  const routeFiles = await findRouteFiles(__dirname).catch((error) => {
    // Evitamos que el error rompa el proceso de build
    return [];
  });

  // Solo procesar si hay archivos
  if (routeFiles.length === 0) return;

  api.routes = [];

  for (const routeFile of routeFiles) {
    try {
      // Importación dinámica ajustada
      const route = await import(/* @vite-ignore */ `${routeFile}`);

      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      for (const method of methods) {
        if (route[method]) {
          const parts = getHonoPath(routeFile);
          const honoPath = `/${parts.map(({ pattern }) => pattern).join('/')}`;
          
          const handler: Handler = async (c) => {
            const params = c.req.param();
            // En producción usamos la ruta ya importada
            if (import.meta.env.DEV) {
                const updatedRoute = await import(/* @vite-ignore */ `${routeFile}?update=${Date.now()}`);
                return await updatedRoute[method](c.req.raw, { params });
            }
            return await route[method](c.req.raw, { params });
          };

          const methodLowercase = method.toLowerCase() as any;
          if (api[methodLowercase]) {
            api[methodLowercase](honoPath, handler);
          }
        }
      }
    } catch (error) {
      // Log simple para no ensuciar el build si un archivo falla
      console.error(`No se pudo cargar la ruta: ${routeFile}`);
    }
  }
}

// Ejecutar registro
await registerRoutes();

// ... (resto del código de Hot Reload)