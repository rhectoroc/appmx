import { readdir, stat } from 'node:fs/promises';
import path, { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url'; // Añadido pathToFileURL
import { Hono } from 'hono';
import type { Handler } from 'hono/types';
import updatedFetch from '../src/__create/fetch';
import { existsSync } from 'node:fs';

export const API_BASENAME = '/api';
const api = new Hono();

// Ajustamos para que busque tanto en src (dev) como en build (prod)
const __dirname = join(process.cwd(), 'src/app/api');

if (globalThis.fetch) {
  globalThis.fetch = updatedFetch;
}

// ... función getHonoPath (asegúrate de que esté definida) ...
function getHonoPath(routeFile: string) {
    const relativePath = path.relative(__dirname, routeFile);
    const parts = relativePath.split(path.sep);
    return parts
      .filter(part => part !== 'route.js' && part !== 'route.ts')
      .map(part => {
        if (part.startsWith('[') && part.endsWith(']')) {
          return { pattern: `:${part.slice(1, -1)}` };
        }
        return { pattern: part };
      });
}

async function findRouteFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) {
    console.warn(`⚠️ API directory not found at: ${dir}`);
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
      } else if (file.match(/^route\.(js|ts)$/)) { // Regex más limpio
        routes.push(filePath);
      }
    } catch (error) {
      console.error(`Error reading file ${file}:`, error);
    }
  }
  return routes;
}

async function registerRoutes() {
  const routeFiles = await findRouteFiles(__dirname);
  if (routeFiles.length === 0) return;

  for (const routeFile of routeFiles) {
    try {
      // Usar pathToFileURL asegura compatibilidad con Windows y Linux en Docker
      const fileUrl = pathToFileURL(routeFile).href;
      const route = await import(/* @vite-ignore */ fileUrl);

      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      for (const method of methods) {
        if (route[method]) {
          const parts = getHonoPath(routeFile);
          const honoPath = parts.length === 0 ? '/' : `/${parts.map(p => p.pattern).join('/')}`;
          
          const handler: Handler = async (c) => {
            const params = c.req.param();
            if (import.meta.env.DEV) {
                // Cache busting solo en desarrollo
                const updatedRoute = await import(/* @vite-ignore */ `${fileUrl}?update=${Date.now()}`);
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
      console.error(`❌ Error cargando ruta ${routeFile}:`, error);
    }
  }
}

await registerRoutes();

// EXPORTACIÓN FINAL (Crucial para index.ts)
export { api };

// Hot reload routes in development
if (import.meta.env.DEV && import.meta.hot) {
    import.meta.hot.accept((newSelf) => {
      registerRoutes().catch((err) => {
        console.error('Error reloading routes:', err);
      });
    });
}