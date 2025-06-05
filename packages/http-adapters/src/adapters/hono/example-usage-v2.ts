import { Hono, Context } from 'hono';
import { ReAuthEngine } from '@re-auth/reauth';
import {
  createHonoAdapter,
  createHonoAdapterV2,
  HonoAdapterV2,
  createContextRule,
  createCustomRoute,
  createRouteOverride,
  OAuth2ContextRules,
  type HonoAdapterConfig,
  HonoFrameworkAdapter,
} from './hono-adapter-v2';

/**
 * Basic Hono adapter usage with V2 factory pattern
 */
export function createBasicHonoAdapter(reAuthEngine: ReAuthEngine) {
  const config: HonoAdapterConfig = {
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
  const adapter = createHonoAdapter(reAuthEngine, config);
  
  // Get the Hono app
  const app = adapter.getApp();

  // Add custom routes
  adapter.addRoute('GET', '/health', async (c) => {
    return c.json({ status: 'ok' });
  });

  // Add protected route
  adapter.addRoute('GET', '/profile', async (c) => {
    const user = (c as any).get('user');
    return c.json({ user });
  }, { requireAuth: true });

  return app;
}

/**
 * Advanced Hono adapter with context rules for OAuth
 */
export function createOAuthHonoAdapter(reAuthEngine: ReAuthEngine) {
  const config: HonoAdapterConfig = {
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
        transformInput: (key, value, context) => {
          if (key === 'x-api-key') {
            // Validate API key format
            return value.startsWith('ak_') ? value : null;
          }
          return value;
        },
      }),
    ],
  };

  // Using the factory function directly
  const frameworkAdapter = new HonoFrameworkAdapter();
  const app = createHonoAdapterV2(reAuthEngine, config,frameworkAdapter);

  return app;
}

/**
 * Multi-tenant Hono adapter with tenant-specific context
 */
export function createMultiTenantHonoAdapter(reAuthEngine: ReAuthEngine) {
  const config: HonoAdapterConfig = {
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
        transformInput: (key, value, context) => {
          if (key === 'tenantId') {
            // Extract tenant from subdomain if not in header
            if (!value) {
              const host = context.req.header('host');
              const subdomain = host?.split('.')[0];
              return subdomain !== 'www' ? subdomain : null;
            }
          }
          return value;
        },
        transformOutput: (key, value, result, context) => {
          if (key === 'tenant_session') {
            // Set secure cookie options for tenant session
            return {
              value: value,
              domain: `.${context.req.header('host')?.split('.').slice(-2).join('.')}`,
              httpOnly: true,
              secure: true,
            };
          }
          return value;
        },
      }),
    ],
  };

  const adapter = createHonoAdapter(reAuthEngine, config);
  const app = adapter.getApp();

  // Add tenant-aware middleware
  app.use('*', async (c, next) => {
    const tenantId = c.req.header('x-tenant-id') || 
                    c.req.header('host')?.split('.')[0];
    
    if (tenantId) {
      // c.set('tenantId', tenantId);
    }
    
    await next();
  });

  // Add tenant-specific routes
  adapter.addRoute('GET', '/tenant/info', async (c) => {
    const tenantId = c.get('tenantId');
    const user = c.get('user');
    
    return c.json({
      tenant: tenantId,
      user: user?.id,
      authenticated: c.get('authenticated'),
    });
  });

  return app;
}

/**
 * Production-ready Hono adapter with comprehensive configuration
 */
export function createProductionHonoAdapter(reAuthEngine: ReAuthEngine) {
  const config: HonoAdapterConfig = {
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
    
    // Context rules for OAuth and security
    contextRules: [
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
          async (c: any, next: any) => {
            // Rate limiting logic here
            await next();
          },
        ],
      }),
    ],
    
    // Custom routes
    customRoutes: [
      createCustomRoute('GET', '/auth/status', async (c: any) => {
        return c.json({
          authenticated: c.get('authenticated'),
          user: c.get('user')?.id || null,
          timestamp: new Date().toISOString(),
        });
      }),
      
      createCustomRoute('POST', '/auth/logout', async (c: any) => {
        // Clear all auth cookies
        c.header('Set-Cookie', 'secure_session=; Max-Age=0; Path=/; HttpOnly');
        return c.json({ success: true, message: 'Logged out successfully' });
      }),
    ],
    
    // Global middleware
    globalMiddleware: [
      // CORS middleware
      async (c: any, next: any) => {
        c.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
        c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
        c.header('Access-Control-Allow-Credentials', 'true');
        
        if (c.req.method === 'OPTIONS') {
          return c.text('', 204);
        }
        
        await next();
      },
    ],
    
    // Custom error handler
    errorHandler: (error, context) => {
      console.error('ReAuth Error:', error);
      
      return (context as any).json({
        success: false,
        message: process.env.NODE_ENV === 'production' 
          ? 'An error occurred' 
          : error.message,
        timestamp: new Date().toISOString(),
      }, 500);
    },
  };

  const adapter = createHonoAdapter(reAuthEngine, config);
  const app = adapter.getApp();

  // Add protection middleware for admin routes
  const adminProtection = adapter.protect({
    roles: ['admin', 'super_admin'],
    authorize: async (user, context) => {
      // Additional authorization logic
      const adminKey = (context as any).req.header('x-admin-key');
      return adminKey === process.env.ADMIN_SECRET_KEY;
    },
  });

  // Add admin routes with protection
  adapter.addRoute('GET', '/admin/users', async (c) => {
    // Admin-only user management
    return c.json({ users: [] });
  }, { 
    middleware: [adminProtection],
    requireAuth: true,
  });

  return app;
}

/**
 * Utility function to create a complete Hono application with ReAuth
 */
export function createCompleteHonoApp(reAuthEngine: ReAuthEngine) {
  const app = new Hono();
  
  // Create and mount the auth adapter
  const authAdapter = createProductionHonoAdapter(reAuthEngine);
  app.route('/', authAdapter);
  
  // Add other application routes
  app.get('/', (c) => c.json({ message: 'ReAuth Hono App', version: '1.0.0' }));
  
  app.get('/api/protected', async (c) => {
    const user = (c as any).get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    return c.json({ 
      message: 'Protected resource',
      userId: user.id,
    });
  });
  
  return app;
} 