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

// Debug endpoint to verify Gemini API key (remove in production)
app.get('/debug/gemini', async (c) => {
  const apiKey = process.env.GOOGLE_API_KEY;
  const keyInfo = apiKey
    ? { set: true, prefix: apiKey.substring(0, 10) + '...', length: apiKey.length }
    : { set: false };

  let geminiTest: { success: boolean; error?: string; response?: string } = { success: false };

  if (apiKey) {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent('Say "hello" in one word.');
      geminiTest = { success: true, response: result.response.text().substring(0, 100) };
    } catch (err) {
      geminiTest = { success: false, error: String(err).substring(0, 500) };
    }
  }

  return c.json({
    apiKey: keyInfo,
    geminiTest,
    env: process.env.NODE_ENV || 'not set',
  });
});

// ==========================================
// Swagger / OpenAPI Documentation
// ==========================================

// Serve OpenAPI JSON spec (dynamically sets server URL from request)
app.get('/api/docs/openapi.json', (c) => {
  const url = new URL(c.req.url);
  const currentOrigin = `${url.protocol}//${url.host}`;

  const spec = {
    ...openApiSpec,
    servers: [
      { url: currentOrigin, description: 'Current server' },
      ...(openApiSpec.servers || []),
    ],
  };

  return c.json(spec);
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
