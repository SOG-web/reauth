import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ReAuthEngine } from '@re-auth/reauth';
import {
  createFastifyAdapter,
  createFastifyAdapterV2,
  FastifyAdapterV2,
  createContextRule,
  createCustomRoute,
  createRouteOverride,
  OAuth2ContextRules,
  type FastifyAdapterConfig,
  FastifyFrameworkAdapter,
} from './fastify-adapter-v2';

/**
 * Basic Fastify adapter usage with V2 factory pattern
 */
export async function createBasicFastifyAdapter(
  fastify: FastifyInstance,
  reAuthEngine: ReAuthEngine
) {
  const config: FastifyAdapterConfig = {
    basePath: '/auth',
    cookieName: 'session_token',
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  };

  // Using the convenience wrapper class
  const adapter = createFastifyAdapter(fastify, reAuthEngine, config);

  // Add custom routes
  adapter.addRoute('GET', '/health', async (request, reply) => {
    return reply.send({ status: 'ok' });
  });

  // Add protected route
  adapter.addRoute('GET', '/profile', async (request: any, reply) => {
    const user = request.user;
    return reply.send({ user });
  }, { requireAuth: true });

  return adapter;
}

/**
 * Advanced Fastify adapter with context rules for OAuth
 */
export async function createOAuthFastifyAdapter(
  fastify: FastifyInstance,
  reAuthEngine: ReAuthEngine
) {
  const config: FastifyAdapterConfig = {
    basePath: '/auth',
    cookieName: 'session_token',
    contextRules: [
      // OAuth state and redirect handling
      OAuth2ContextRules.callback('oauth-github'),
      OAuth2ContextRules.start('oauth-github'),
      OAuth2ContextRules.callback('oauth-google'),
      OAuth2ContextRules.start('oauth-google'),
      
      // Custom context rule for API keys
      createContextRule('api-auth', {
        stepName: 'verify-key',
        extractHeaders: ['x-api-key'],
        extractCookies: ['refresh_token'],
        setCookies: ['new_refresh_token'],
        transformInput: (key, value, request) => {
          if (key === 'x-api-key') {
            // Validate API key format
            return value.startsWith('ak_') ? value : null;
          }
          return value;
        },
      }),
    ],
    
    // Custom routes for OAuth flows
    customRoutes: [
      createCustomRoute('GET', '/auth/callback', async (request: any, reply: any) => {
        const code = request.query.code;
        const state = request.query.state;
        
        if (!code || !state) {
          return reply.status(400).send({ error: 'Missing code or state' });
        }

        // Handle OAuth callback
        return reply.send({ success: true, redirectTo: '/dashboard' });
      }),
    ],
  };

  // Using the factory function directly
  const frameworkAdapter = new FastifyFrameworkAdapter(fastify);
  const createAdapter = createFastifyAdapterV2(fastify, frameworkAdapter);
  createAdapter(reAuthEngine, config);

  return fastify;
}

/**
 * Multi-tenant Fastify adapter with tenant-specific context
 */
export async function createMultiTenantFastifyAdapter(
  fastify: FastifyInstance,
  reAuthEngine: ReAuthEngine
) {
  const config: FastifyAdapterConfig = {
    basePath: '/api/v1/auth',
    contextRules: [
      // Extract tenant information from headers and subdomains
      createContextRule('*', { // Apply to all plugins
        extractHeaders: {
          'x-tenant-id': 'tenantId',
          'x-workspace': 'workspaceId',
        },
        extractCookies: ['tenant_preference'],
        setCookies: ['tenant_session'],
        transformInput: (key, value, request: any) => {
          if (key === 'tenantId') {
            // Extract tenant from subdomain if not in header
            if (!value) {
              const host = request.headers.host;
              const subdomain = host?.split('.')[0];
              return subdomain !== 'www' ? subdomain : null;
            }
          }
          return value;
        },
        transformOutput: (key, value, result, request: any) => {
          if (key === 'tenant_session') {
            // Set secure cookie options for tenant session
            return {
              value: value,
              domain: `.${request.headers.host?.split('.').slice(-2).join('.')}`,
              httpOnly: true,
              secure: true,
            };
          }
          return value;
        },
      }),
    ],
  };

  const adapter = createFastifyAdapter(fastify, reAuthEngine, config);

  // Add tenant-aware hook
  fastify.addHook('onRequest', async (request: any, reply) => {
    const tenantId = request.headers['x-tenant-id'] || 
                    request.headers.host?.split('.')[0];
    
    if (tenantId) {
      request.tenantId = tenantId;
    }
  });

  // Add tenant-specific routes
  adapter.addRoute('GET', '/tenant/info', async (request: any, reply) => {
    const tenantId = request.tenantId;
    const user = request.user;
    
    return reply.send({
      tenant: tenantId,
      user: user?.id,
      authenticated: request.isAuthenticated,
    });
  });

  return adapter;
}

/**
 * Production-ready Fastify adapter with comprehensive configuration
 */
export async function createProductionFastifyAdapter(
  fastify: FastifyInstance,
  reAuthEngine: ReAuthEngine
) {
  const config: FastifyAdapterConfig = {
    basePath: '/auth',
    cookieName: 'secure_session',
    cookieOptions: {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    },
    
    // Auto-introspection configuration
    autoIntrospection: {
      enabled: true,
      includePlugins: ['email-password', 'oauth-google', 'oauth-github'],
      excludeSteps: ['admin.ban-user'], // Exclude sensitive admin steps
      pathGenerator: (pluginName, stepName, basePath) => {
        // Custom path generation for better API structure
        if (pluginName.startsWith('oauth-')) {
          const provider = pluginName.replace('oauth-', '');
          return `${basePath}/oauth/${provider}/${stepName}`;
        }
        return `${basePath}/${pluginName}/${stepName}`;
      },
    },
    
    // Comprehensive context rules
    contextRules: [
      // OAuth flows
      OAuth2ContextRules.callback('oauth-github'),
      OAuth2ContextRules.start('oauth-github'),
      OAuth2ContextRules.callback('oauth-google'),
      OAuth2ContextRules.start('oauth-google'),
      
      // Security headers and CSRF protection
      createContextRule('*', {
        extractHeaders: {
          'x-csrf-token': 'csrfToken',
          'x-forwarded-for': 'clientIp',
          'user-agent': 'userAgent',
        },
        setHeaders: {
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY',
          'x-xss-protection': '1; mode=block',
        },
      }),
    ],
    
    // Route overrides for custom behavior
    routeOverrides: [
      createRouteOverride('email-password', 'register', {
        middleware: [
          // Add rate limiting middleware
          async (request: any, reply: any) => {
            // Rate limiting logic here
          },
        ],
      }),
    ],
    
    // Custom routes
    customRoutes: [
      createCustomRoute('GET', '/auth/status', async (request: any, reply: any) => {
        return reply.send({
          authenticated: request.isAuthenticated,
          user: request.user?.id || null,
          timestamp: new Date().toISOString(),
        });
      }),
      
      createCustomRoute('POST', '/auth/logout', async (request: any, reply: any) => {
        // Clear all auth cookies
        reply.clearCookie('secure_session');
        return reply.send({ success: true, message: 'Logged out successfully' });
      }),
    ],
    
    // Global middleware (using Fastify hooks)
    globalMiddleware: [
      // CORS middleware
      async (request: any, reply: any) => {
        reply.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
        reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
        reply.header('Access-Control-Allow-Credentials', 'true');
        
        if (request.method === 'OPTIONS') {
          return reply.status(204).send();
        }
      },
    ],
    
    // Custom error handler
    errorHandler: (error, context) => {
      console.error('ReAuth Error:', error);
      
      return (context as any).status(500).send({
        success: false,
        message: process.env.NODE_ENV === 'production' 
          ? 'An error occurred' 
          : error.message,
        timestamp: new Date().toISOString(),
      });
    },
  };

  const adapter = createFastifyAdapter(fastify, reAuthEngine, config);

  // Add protection middleware for admin routes
  const adminProtection = adapter.protect({
    roles: ['admin', 'super_admin'],
    authorize: async (user, request, reply) => {
      // Additional authorization logic
      const adminKey = request.headers['x-admin-key'];
      return adminKey === process.env.ADMIN_SECRET_KEY;
    },
  });

  // Add admin routes with protection
  adapter.addRoute('GET', '/admin/users', async (request, reply) => {
    // Admin-only user management
    return reply.send({ users: [] });
  }, { 
    middleware: [adminProtection],
    requireAuth: true,
  });

  return adapter;
}

/**
 * Utility function to create a Fastify plugin for ReAuth
 */
export async function createReAuthFastifyPlugin(reAuthEngine: ReAuthEngine) {
  return FastifyAdapterV2.createPlugin(reAuthEngine, {
    basePath: '/auth',
    cookieName: 'auth_token',
    autoIntrospection: {
      enabled: true,
    },
  });
}

/**
 * Complete example showing how to set up a Fastify server with ReAuth
 */
export async function createCompleteFastifyApp(reAuthEngine: ReAuthEngine) {
  const fastify = require('fastify')({ logger: true });

  // Register cookie support
  await fastify.register(require('@fastify/cookie'));

  // Register CORS
  await fastify.register(require('@fastify/cors'), {
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
  });

  // Create and register the auth adapter
  const adapter = await createProductionFastifyAdapter(fastify, reAuthEngine);

  // Add other application routes
  fastify.get('/', async (request: any, reply: any) => {
    return { message: 'ReAuth Fastify App', version: '1.0.0' };
  });

  fastify.get('/api/protected', async (request: any, reply: any) => {
    if (!request.isAuthenticated) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    
    return {
      message: 'Protected resource',
      userId: request.user.id,
    };
  });

  return fastify;
} 