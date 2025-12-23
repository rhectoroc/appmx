// __create/route-builder.ts
import { Hono } from 'hono';

export const API_BASENAME = '/api';
export const api = new Hono();

// Simple health check para API
api.get('/health', (c) => c.json({ 
  status: 'ok', 
  service: 'api',
  timestamp: new Date().toISOString()
}));

// Test endpoint
api.get('/test', (c) => c.json({ 
  message: 'API is working!',
  success: true
}));

// Echo endpoint para debugging
api.post('/echo', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return c.json({
    message: 'Echo received',
    data: body,
    headers: Object.fromEntries(c.req.raw.headers),
    timestamp: new Date().toISOString()
  });
});

console.log('✅ API routes registered in route-builder.ts');