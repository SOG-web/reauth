// Fastify Integration Example
import Fastify, { FastifyInstance } from 'fastify';
import { ReAuthEngineV2 } from '@re-auth/reauth';
import { createFastifyAdapter } from '@re-auth/http-adapters-v2';

// Create Fastify instance
const fastify: FastifyInstance = Fastify({
  logger: true,
});

// Initialize ReAuth V2 Engine
const engine = new ReAuthEngineV2({
  dbClient: yourDatabaseClient, // Configure with your database
  plugins: [
    // Add your V2 authentication plugins here
  ],
});

// Create Fastify adapter
const adapter = createFastifyAdapter({
  engine,
  basePath: '/api/auth',
  cors: {
    origin: true, // Allow all origins in development
    credentials: true,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 200, // Higher limit for Fastify's performance
  },
  security: {
    helmet: true,
  },
});

// Register the ReAuth plugin
fastify.register(adapter.createPlugin());

// OPTION 1: Register user plugin globally to populate request.user on all requests
fastify.register(adapter.createUserPlugin());

// OPTION 2: Register user plugin on specific contexts only
// fastify.register(adapter.createUserPlugin(), { prefix: '/api/protected' });

// Optional: Add schema validation for better performance
fastify.addSchema({
  $id: 'authResponse',
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object' },
    meta: {
      type: 'object',
      properties: {
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  },
});

// Example protected route using request.user (populated by hook)
fastify.get('/api/profile', async (request, reply) => {
  const user = (request as any).user;
  
  if (!user) {
    return reply.status(401).send({ error: 'Authentication required' });
  }
  
  return {
    message: 'Profile data',
    user: user.subject,
    sessionValid: user.valid,
  };
});

// Example route manually checking for current user
fastify.get('/api/dashboard', async (request, reply) => {
  const user = await adapter.getCurrentUser(request);
  
  if (!user) {
    return reply.status(401).send({ error: 'Authentication required' });
  }
  
  return {
    message: 'Dashboard data',
    user: user.subject,
    lastAccessed: user.metadata?.lastAccessed,
  };
});

// Example route with optional authentication
fastify.get('/api/content', async (request, reply) => {
  const user = await adapter.getCurrentUser(request);
  
  return {
    message: 'Content data',
    isAuthenticated: !!user,
    user: user?.subject || null,
    // Show different content based on authentication status
    content: user ? 'Premium content' : 'Public content',
  };
});

// Health check route
fastify.get('/health', {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          timestamp: { type: 'string' },
          endpoints: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                method: { type: 'string' },
                path: { type: 'string' },
                plugin: { type: 'string' },
                step: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
}, async (request, reply) => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    endpoints: adapter.getEndpoints().map(endpoint => ({
      method: endpoint.method,
      path: endpoint.path,
      plugin: endpoint.pluginName,
      step: endpoint.stepName,
    })),
  };
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Fastify server listening on port 3000');
    console.log('Authentication endpoints:');
    
    adapter.getEndpoints().forEach(endpoint => {
      console.log(`  ${endpoint.method} http://localhost:3000${endpoint.path}`);
    });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

export default fastify;