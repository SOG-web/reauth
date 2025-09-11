// Hono Integration Example  
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { ReAuthEngineV2 } from '@re-auth/reauth';
import { createHonoAdapter } from '@re-auth/http-adapters-v2';

// Create Hono app
const app = new Hono();

// Add middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['https://your-frontend.com', 'http://localhost:3000'],
  credentials: true,
}));

// Initialize ReAuth V2 Engine
const engine = new ReAuthEngineV2({
  dbClient: yourDatabaseClient, // Configure with your database
  plugins: [
    // Add your V2 authentication plugins here
  ],
});

// Create Hono adapter
const adapter = createHonoAdapter({
  engine,
  basePath: '/api/auth',
  cors: {
    origin: ['https://your-frontend.com', 'http://localhost:3000'],
    credentials: true,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 150,
  },
  security: {
    helmet: true,
  },
  validation: {
    validateInput: true,
    maxPayloadSize: 512 * 1024, // 512KB for edge functions
  },
});

// OPTION 1: Use user middleware globally to populate c.get('user') on all requests
app.use('*', adapter.createUserMiddleware());

// OPTION 2: Use user middleware on specific routes only
// app.use('/api/protected/*', adapter.createUserMiddleware());

// Method 1: Register routes directly on main app
adapter.registerRoutes(app, '/api/auth');

// Method 2: Alternative - Create dedicated auth app and mount it
// const authApp = adapter.createApp();
// app.route('/api/auth', authApp);

// Example protected route using c.get('user') (populated by middleware)
app.get('/api/profile', (c) => {
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  return c.json({
    message: 'Profile data',
    user: user.subject,
    sessionValid: user.valid,
  });
});

// Example route manually checking for current user
app.get('/api/dashboard', async (c) => {
  const user = await adapter.getCurrentUser(c);
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  return c.json({
    message: 'Dashboard data',
    user: user.subject,
    lastAccessed: user.metadata?.lastAccessed,
  });
});

// Example route with optional authentication
app.get('/api/content', async (c) => {
  const user = await adapter.getCurrentUser(c);
  
  return c.json({
    message: 'Content data',
    isAuthenticated: !!user,
    user: user?.subject || null,
    // Show different content based on authentication status
    content: user ? 'Premium content' : 'Public content',
  });
});

// Health and info endpoints
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: 'hono',
  });
});

app.get('/api/auth/info', (c) => {
  const endpoints = adapter.getEndpoints();
  return c.json({
    success: true,
    data: {
      totalEndpoints: endpoints.length,
      plugins: [...new Set(endpoints.map(e => e.pluginName))],
      endpoints: endpoints.map(endpoint => ({
        method: endpoint.method,
        path: endpoint.path,
        plugin: endpoint.pluginName,
        step: endpoint.stepName,
        requiresAuth: endpoint.requiresAuth,
      })),
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

// Error handling
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  }, 500);
});

// For Node.js deployment
const port = 3000;
console.log(`Starting Hono server on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});

console.log('Authentication endpoints:');
adapter.getEndpoints().forEach(endpoint => {
  console.log(`  ${endpoint.method} http://localhost:${port}${endpoint.path}`);
});

// For serverless deployment (Cloudflare Workers, etc.)
export default app;

// For Bun deployment
// export default {
//   port: 3000,
//   fetch: app.fetch,
// };