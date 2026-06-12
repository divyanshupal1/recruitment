import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { swaggerUI } from '@hono/swagger-ui';

import chats from './routes/chats.js';
import files from './routes/files.js';
import generate from './routes/generate.js';
import { openApiSpec } from './lib/openapi-spec.js';

// ==========================================
// App Setup
// ==========================================

const app = new Hono();

// ==========================================
// Middleware
// ==========================================

app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ==========================================
// Health Check
// ==========================================

app.get('/', (c) => {
  return c.json({
    service: 'recruitment-agent',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// ==========================================
// Swagger / OpenAPI Documentation
// ==========================================

// Serve OpenAPI JSON spec
app.get('/api/docs/openapi.json', (c) => {
  return c.json(openApiSpec);
});

// Serve Swagger UI at /docs
app.get('/docs', swaggerUI({ url: '/api/docs/openapi.json' }));

// ==========================================
// API Routes
// ==========================================

// Chat management
app.route('/api/chats', chats);

// File upload & listing (mounted under /api/chats so :chatId is accessible)
app.route('/api/chats', files);

// Drive generation (mounted under /api/chats so :chatId is accessible)
app.route('/api/chats', generate);

// ==========================================
// Global Error Handler
// ==========================================

app.onError((err, c) => {
  console.error('[Server] Unhandled error:', err);
  return c.json(
    {
      error: 'Internal server error',
      message: err.message,
    },
    500
  );
});

app.notFound((c) => {
  return c.json(
    {
      error: 'Not found',
      message: `Route ${c.req.method} ${c.req.path} not found`,
    },
    404
  );
});

// ==========================================
// Start Server
// ==========================================

const port = parseInt(process.env.PORT || '3000', 10);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`
╔══════════════════════════════════════════════╗
║   🚀 Recruitment Agent API Server           ║
║   Running on http://localhost:${info.port}          ║
╠══════════════════════════════════════════════╣
║   📖 Swagger UI: http://localhost:${info.port}/docs  ║
╠══════════════════════════════════════════════╣
║   Endpoints:                                 ║
║   POST   /api/chats                          ║
║   GET    /api/chats                          ║
║   GET    /api/chats/:id                      ║
║   GET    /api/chats/:id/messages             ║
║   POST   /api/chats/:id/files                ║
║   GET    /api/chats/:id/files                ║
║   POST   /api/chats/:id/generate             ║
║   GET    /api/chats/:id/drive-data           ║
╚══════════════════════════════════════════════╝
    `);
  }
);

export default app;
