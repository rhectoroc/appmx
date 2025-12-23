import { readdir, stat } from 'node:fs/promises';
import path, { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Hono } from 'hono';
import type { Handler } from 'hono/types';
import updatedFetch from '../src/__create/fetch';
import { existsSync } from 'node:fs';

export const API_BASENAME = '/api';
const api = new Hono();

// --- CORRECCIÓN DE RUTA DINÁMICA ---
const getApiDirectory = () => {
  const paths = [
    join(process.cwd(), 'src/app/api'),        // Local / Dev
    join(process.cwd(), 'build/server/api'),   // Producción (si el build las mueve)
    join(process.cwd(), 'app/api'),            // Estructura alternativa
  ];

  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return paths[0]; // Fallback al default
};

const __dirname = getApiDirectory();
// -----------------------------------

if (globalThis.fetch) {
  globalThis.fetch = updatedFetch;
}

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
    console.warn(`⚠️ Directorio de API no encontrado en: ${dir}`);
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
      } else if (file.match(/^route\.(js|ts)$/)) {
        routes.push(filePath);
      }
    } catch (error) {
      console.error(`Error leyendo archivo ${file}:`, error);
    }
  }
  return routes;
}

async function registerRoutes() {
  console.log(`🔍 Buscando rutas de API en: ${__dirname}`);
  const routeFiles = await findRouteFiles(__dirname);
  
  if (routeFiles.length === 0) {
    console.warn("⚠️ No se encontraron archivos de ruta (route.ts/js)");
    return;
  }

  for (const routeFile of routeFiles) {
    try {
      const fileUrl = pathToFileURL(routeFile).href;
      const route = await import(/* @vite-ignore */ fileUrl);

      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      for (const method of methods) {
        if (route[method]) {
          const parts = getHonoPath(routeFile);
          const honoPath = parts.length === 0 ? '/' : `/${parts.map(p => p.pattern).join('/')}`;
          
          const handler: Handler = async (c) => {
            const params = c.req.param();
            // Soporte para desarrollo y producción
            const activeRoute = (process.env.NODE_ENV === 'development') 
              ? await import(/* @vite-ignore */ `${fileUrl}?update=${Date.now()}`)
              : route;
            
            return await activeRoute[method](c.req.raw, { params });
          };

          const methodLowercase = method.toLowerCase() as any;
          if (api[methodLowercase]) {
            api[methodLowercase](honoPath, handler);
            console.log(`✅ Ruta registrada: [${method}] ${API_BASENAME}${honoPath}`);
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error cargando ruta ${routeFile}:`, error);
    }
  }
}

await registerRoutes();
export { api };