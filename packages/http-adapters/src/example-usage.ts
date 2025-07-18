/**
 * Example usage of HTTP adapters with auto-introspection, configurable context extraction, and route overrides
 * Following the same flexible pattern as OAuth plugins
 */

import type { Request, Response, NextFunction } from 'express';
import type { ReAuthEngine } from '@re-auth/reauth';
import { emailPasswordAuth } from '@re-auth/reauth/plugins';
import {
  createExpressAdapter,
  createRouteOverride,
  createCustomRoute,
  createAutoIntrospectionConfig,
  createContextRule,
  OAuth2ContextRules,
  introspectReAuthEngine,
  type ExpressAdapterConfig,
  type AutoGeneratedRoute,
  type ContextExtractionRule,
} from './adapters/express/express-adapter-v2';

// Mock ReAuth engine for examples
const mockReAuth = {} as ReAuthEngine;

// Example 1: Basic adapter with auto-introspection and context rules
export function createBasicAdapterWithContext() {
  const adapter = createExpressAdapter(mockReAuth, {
    basePath: '/auth',
    cookieName: 'session_token',

    // Auto-introspection is enabled by default
    autoIntrospection: createAutoIntrospectionConfig({
      onRoutesGenerated: (routes: AutoGeneratedRoute[]) => {
        console.log('Auto-generated routes:');
        // biome-ignore lint/complexity/noForEach: <explanation>
        routes.forEach((route) => {
          console.log(
            `  ${route.method} ${route.path} -> ${route.pluginName}.${route.stepName}`,
          );
          console.log(`    Auth Required: ${route.requiresAuth}`);
          console.log(`    Inputs: [${route.inputs.join(', ')}]`);
          console.log(`    Description: ${route.description}`);
        });
      },
    }),

    // Configure context extraction rules for different plugins
    contextRules: [
      // OAuth PKCE flow for Google OAuth
      OAuth2ContextRules.pkce('google-oauth'),

      // Regular OAuth flow for GitHub OAuth
      OAuth2ContextRules.regular('github-oauth'),

      // Custom context rule for email-password plugin
      createContextRule('email-password', {
        extractHeaders: ['x-forwarded-for', 'user-agent'],
        transformInput: (key, value, request) => {
          if (key === 'x-forwarded-for') {
            return { ip_address: value };
          }
          if (key === 'user-agent') {
            return { user_agent: value };
          }
          return value;
        },
      }),

      // Admin plugin context rule with API key
      createContextRule('admin', {
        extractHeaders: { 'x-api-key': 'api_key' },
        extractCookies: ['admin_session'],
        transformInput: (key, value, request) => {
          if (key === 'api_key' && !value.startsWith('admin_')) {
            throw new Error('Invalid API key format');
          }
          return value;
        },
      }),
    ],
  });

  return adapter.getRouter();
}

// Example 2: OAuth-specific context configuration
export function createOAuthAdapterWithContext() {
  const config: ExpressAdapterConfig = {
    basePath: '/api/auth',

    autoIntrospection: createAutoIntrospectionConfig({
      includePlugins: ['google-oauth', 'github-oauth', 'facebook-oauth'],
      pathGenerator: (pluginName, stepName, basePath) => {
        return `${basePath}/oauth/${pluginName.replace('-oauth', '')}/${stepName}`;
      },
    }),

    // Comprehensive OAuth context rules
    contextRules: [
      // Google OAuth with PKCE
      createContextRule('google-oauth', {
        extractCookies: ['oauth_state', 'oauth_code_verifier'],
        setCookies: ['oauth_state', 'oauth_code_verifier'],
        extractHeaders: ['x-forwarded-proto'], // For redirect URI validation
        transformInput: (key, value, request) => {
          if (key === 'oauth_state') {
            // Validate state format
            if (!value || value.length < 16) {
              throw new Error('Invalid OAuth state');
            }
          }
          return value;
        },
        transformOutput: (key, value, result, request) => {
          if (key === 'oauth_state' || key === 'oauth_code_verifier') {
            // Set cookie options for OAuth cookies
            return {
              value,
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              maxAge: 10 * 60 * 1000, // 10 minutes
              sameSite: 'lax',
            };
          }
          return value;
        },
      }),

      // GitHub OAuth with regular flow
      createContextRule('github-oauth', {
        extractCookies: ['oauth_state'],
        setCookies: ['oauth_state'],
        extractHeaders: { 'x-github-request-id': 'github_request_id' },
      }),

      // Facebook OAuth specific context
      createContextRule('facebook-oauth', {
        extractCookies: ['oauth_state', 'facebook_app_scoped_user_id'],
        setCookies: ['oauth_state'],
        transformInput: (key, value, request) => {
          if (key === 'facebook_app_scoped_user_id') {
            // Validate Facebook user ID format
            if (!/^\d+$/.test(value)) {
              throw new Error('Invalid Facebook user ID');
            }
          }
          return value;
        },
      }),

      // Step-specific context rules
      createContextRule('google-oauth', {
        stepName: 'callback',
        extractHeaders: { 'x-real-ip': 'callback_ip' },
        transformInput: (key, value, request) => {
          if (key === 'callback_ip') {
            console.log(`OAuth callback from IP: ${value}`);
          }
          return value;
        },
      }),

      createContextRule('google-oauth', {
        stepName: 'start',
        setHeaders: { 'x-oauth-provider': 'google' },
        transformOutput: () => 'google', // Always set to 'google'
      }),
    ],

    // Override OAuth callback with custom redirect handling
    routeOverrides: [
      createRouteOverride('google-oauth', 'callback', {
        handleResponse: (req: Request, res: Response, result: any) => {
          if (result.success) {
            // Clear OAuth cookies after successful auth
            res.clearCookie('oauth_state');
            res.clearCookie('oauth_code_verifier');

            // Set auth cookie
            res.cookie('auth_token', result.token, {
              httpOnly: true,
              secure: true,
              maxAge: 7 * 24 * 60 * 60 * 1000,
            });

            return res.redirect('/dashboard?provider=google');
          }
          return res.redirect(
            `/login?error=${encodeURIComponent(result.message)}`,
          );
        },
      }),
    ],
  };

  return createExpressAdapter(mockReAuth, config);
}

// Example 3: Advanced context extraction with validation and transformation
export function createAdvancedContextAdapter() {
  const config: ExpressAdapterConfig = {
    basePath: '/api/v1/auth',

    autoIntrospection: createAutoIntrospectionConfig({
      enabled: true,
    }),

    contextRules: [
      // Email-password plugin with comprehensive context
      createContextRule('email-password', {
        extractHeaders: [
          'x-forwarded-for',
          'user-agent',
          'x-request-id',
          'accept-language',
        ],
        extractCookies: ['session_hint', 'preferred_locale'],
        transformInput: (key, value, request) => {
          switch (key) {
            case 'x-forwarded-for':
              // Extract real IP from proxy headers
              return value.split(',')[0].trim();
            case 'user-agent':
              // Parse user agent for device info
              return {
                raw: value,
                mobile: /Mobile|Android|iPhone/.test(value),
                browser:
                  value.match(/(Chrome|Firefox|Safari|Edge)/)?.[1] || 'Unknown',
              };
            case 'accept-language':
              // Parse preferred language
              return value.split(',')[0].split('-')[0];
            case 'session_hint':
              // Decode session hint
              try {
                return JSON.parse(atob(value));
              } catch {
                return null;
              }
            default:
              return value;
          }
        },
      }),

      // Login-specific context for rate limiting
      createContextRule('email-password', {
        stepName: 'login',
        extractHeaders: { 'x-forwarded-for': 'client_ip' },
        extractCookies: ['login_attempts'],
        transformInput: (key, value, request) => {
          if (key === 'login_attempts') {
            const attempts = Number.parseInt(value) || 0;
            if (attempts > 5) {
              throw new Error(
                'Too many login attempts. Please try again later.',
              );
            }
            return attempts;
          }
          return value;
        },
      }),

      // Registration context with referral tracking
      createContextRule('email-password', {
        stepName: 'register',
        extractHeaders: { referer: 'referral_source' },
        extractCookies: ['utm_source', 'utm_campaign', 'referral_code'],
        setCookies: ['welcome_flow'],
        transformInput: (key, value, request) => {
          if (key === 'referral_source') {
            try {
              const url = new URL(value);
              return url.hostname;
            } catch {
              return 'direct';
            }
          }
          return value;
        },
        transformOutput: (key, value, result, request) => {
          if (key === 'welcome_flow') {
            // Set welcome flow cookie for new users
            return result.success ? 'new_user' : null;
          }
          return value;
        },
      }),

      // Password reset with security context
      createContextRule('email-password', {
        stepName: 'reset-password',
        extractHeaders: {
          'x-forwarded-for': 'reset_ip',
          'user-agent': 'reset_user_agent',
        },
        extractCookies: ['reset_token_hint'],
        transformInput: (key, value, request) => {
          if (key === 'reset_token_hint') {
            // Validate reset token hint
            const hint = JSON.parse(atob(value));
            if (Date.now() > hint.expires) {
              throw new Error('Reset session expired');
            }
            return hint;
          }
          return value;
        },
      }),

      // Admin plugin with comprehensive security context
      createContextRule('admin', {
        extractHeaders: {
          'x-api-key': 'api_key',
          'x-admin-role': 'admin_role',
          'x-forwarded-for': 'admin_ip',
        },
        extractCookies: ['admin_session', 'admin_2fa'],
        transformInput: (key, value, request) => {
          if (key === 'api_key') {
            if (!value.startsWith('admin_')) {
              throw new Error('Invalid admin API key');
            }
          }
          if (key === 'admin_role') {
            const allowedRoles = ['super_admin', 'admin', 'moderator'];
            if (!allowedRoles.includes(value)) {
              throw new Error('Invalid admin role');
            }
          }
          if (key === 'admin_2fa') {
            // Validate 2FA token
            try {
              const token = JSON.parse(value);
              if (Date.now() > token.expires) {
                throw new Error('2FA token expired');
              }
              return token;
            } catch {
              throw new Error('Invalid 2FA token');
            }
          }
          return value;
        },
      }),
    ],

    // Global middleware for logging context
    globalMiddleware: [
      (req: any, res: Response, next: NextFunction) => {
        req.startTime = Date.now();
        req.requestId = Math.random().toString(36).substring(7);
        console.log(`[${req.requestId}] ${req.method} ${req.path} - Start`);
        next();
      },
    ],

    customRoutes: [
      // Context debugging endpoint
      createCustomRoute(
        'GET',
        '/api/v1/auth/debug/context',
        (req: any, res: Response) => {
          res.json({
            cookies: req.cookies,
            headers: Object.fromEntries(
              Object.entries(req.headers).filter(
                ([key]) =>
                  key.startsWith('x-') ||
                  ['user-agent', 'referer', 'accept-language'].includes(key),
              ),
            ),
            extractedContext: req.extractedContext || {},
          });
        },
      ),
    ],
  };

  return createExpressAdapter(mockReAuth, config);
}

// Example 4: Multi-tenant context extraction
export function createMultiTenantAdapter() {
  const config: ExpressAdapterConfig = {
    basePath: '/auth',

    autoIntrospection: createAutoIntrospectionConfig({
      pathGenerator: (pluginName, stepName, basePath) => {
        // Support tenant-specific paths
        return `${basePath}/:tenant/${pluginName}/${stepName}`;
      },
    }),

    contextRules: [
      // Extract tenant context for all plugins
      createContextRule('email-password', {
        extractHeaders: { 'x-tenant-id': 'tenant_id' },
        transformInput: (key, value, request) => {
          if (key === 'tenant_id') {
            // Validate tenant ID
            if (!/^[a-zA-Z0-9-]+$/.test(value)) {
              throw new Error('Invalid tenant ID format');
            }
            // Get tenant from URL params as fallback
            return value || request.params?.tenant;
          }
          return value;
        },
      }),

      createContextRule('google-oauth', {
        extractHeaders: { 'x-tenant-id': 'tenant_id' },
        extractCookies: ['oauth_state', 'oauth_code_verifier'],
        setCookies: ['oauth_state', 'oauth_code_verifier'],
        transformInput: (key, value, request) => {
          if (key === 'tenant_id') {
            return value || request.params?.tenant;
          }
          return value;
        },
        transformOutput: (key, value, result, request) => {
          if (key === 'oauth_state' || key === 'oauth_code_verifier') {
            // Tenant-scoped OAuth cookies
            const tenantId =
              request.extractedContext?.tenant_id || request.params?.tenant;
            return {
              value,
              domain: `.${tenantId}.example.com`,
              httpOnly: true,
              secure: true,
            };
          }
          return value;
        },
      }),
    ],

    globalMiddleware: [
      // Tenant validation middleware
      (req: any, res: Response, next: NextFunction) => {
        const tenantId = req.params?.tenant || req.headers['x-tenant-id'];
        if (!tenantId) {
          return res.status(400).json({ error: 'Tenant ID required' });
        }
        req.tenantId = tenantId;
        next();
      },
    ],
  };

  return createExpressAdapter(mockReAuth, config);
}

// Example 5: Production configuration with context rules
export function createProductionAdapterWithContext(config: RealUsageConfig) {
  const adapterConfig: ExpressAdapterConfig = {
    basePath: config.basePath || '/auth',
    cookieName: config.cookieName || 'auth_token',
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },

    autoIntrospection: createAutoIntrospectionConfig({
      enabled: true,
      excludePlugins: config.excludePlugins || ['admin'],
      onRoutesGenerated: (routes) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(
            `Generated ${routes.length} authentication routes with context rules`,
          );
        }
      },
    }),

    // Production context rules
    contextRules: [
      // OAuth plugins with production-ready context
      ...['google-oauth', 'github-oauth', 'facebook-oauth'].map((plugin) =>
        OAuth2ContextRules.pkce(plugin),
      ),

      // Security context for all authentication
      createContextRule('email-password', {
        extractHeaders: {
          'x-forwarded-for': 'client_ip',
          'user-agent': 'user_agent',
          'x-request-id': 'request_id',
        },
        transformInput: (key, value, request) => {
          if (key === 'client_ip') {
            // Extract real IP from load balancer
            return value.split(',')[0].trim();
          }
          return value;
        },
      }),

      // Rate limiting context
      createContextRule('email-password', {
        stepName: 'login',
        extractCookies: ['rate_limit_token'],
        transformInput: (key, value, request) => {
          if (key === 'rate_limit_token') {
            // Validate rate limit token
            try {
              const token = JSON.parse(atob(value));
              if (Date.now() > token.expires) {
                return null;
              }
              return token;
            } catch {
              return null;
            }
          }
          return value;
        },
      }),
    ],

    routeOverrides: [
      // Production OAuth callback handling
      createRouteOverride('google-oauth', 'callback', {
        handleResponse: (req: Request, res: Response, result: any) => {
          if (result.success) {
            // Clear OAuth cookies
            res.clearCookie('oauth_state');
            res.clearCookie('oauth_code_verifier');

            // Set secure auth cookie
            res.cookie('auth_token', result.token, {
              httpOnly: true,
              secure: true,
              sameSite: 'strict',
              maxAge: 7 * 24 * 60 * 60 * 1000,
            });

            const redirectUrl =
              process.env.FRONTEND_URL || 'https://app.example.com';
            return res.redirect(`${redirectUrl}/dashboard`);
          }
          const redirectUrl =
            process.env.FRONTEND_URL || 'https://app.example.com';
          return res.redirect(
            `${redirectUrl}/login?error=${encodeURIComponent(result.message)}`,
          );
        },
      }),
    ],

    customRoutes: [
      createCustomRoute('GET', '/health', (req: Request, res: Response) => {
        res.json({
          status: 'ok',
          version: process.env.APP_VERSION,
          timestamp: new Date().toISOString(),
        });
      }),
    ],

    errorHandler: (error: Error, context: any) => {
      console.error('Auth error:', error);
      const { response } = context;

      if (process.env.NODE_ENV === 'production') {
        return response.status(500).json({
          success: false,
          message: 'Internal server error',
        });
      }

      return response.status(500).json({
        success: false,
        message: error.message,
        stack: error.stack,
      });
    },
  };

  return createExpressAdapter(config.reAuthEngine, adapterConfig);
}

// Example 6: Direct Express adapter usage with configurable context
export function createDirectExpressAdapterWithContext() {
  const config: ExpressAdapterConfig = {
    basePath: '/auth',

    // Configure context rules that will be used by both factory and Express adapter
    contextRules: [
      // OAuth with PKCE - cookies will be set/extracted automatically
      createContextRule('google-oauth', {
        extractCookies: ['oauth_state', 'oauth_code_verifier'],
        setCookies: ['oauth_state', 'oauth_code_verifier'],
        transformOutput: (key, value, result, request) => {
          if (key === 'oauth_state' || key === 'oauth_code_verifier') {
            // Return cookie with options
            return {
              value,
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              maxAge: 10 * 60 * 1000, // 10 minutes
              sameSite: 'lax',
            };
          }
          return value;
        },
      }),

      // Email-password with security headers
      createContextRule('email-password', {
        extractHeaders: {
          'x-forwarded-for': 'client_ip',
          'user-agent': 'user_agent',
        },
        setHeaders: ['x-auth-source'], // Will set this header in response
        transformInput: (key, value, request) => {
          if (key === 'client_ip') {
            return value.split(',')[0].trim();
          }
          return value;
        },
        transformOutput: (key, value, result, request) => {
          if (key === 'x-auth-source') {
            return 'email-password'; // Always set to plugin name
          }
          return value;
        },
      }),

      // Login step specific context
      createContextRule('email-password', {
        stepName: 'login',
        extractCookies: ['login_attempts', 'device_fingerprint'],
        setCookies: ['last_login'],
        transformInput: (key, value, request) => {
          if (key === 'login_attempts') {
            const attempts = Number.parseInt(value) || 0;
            console.log(
              `Login attempts for ${request.body?.email}: ${attempts}`,
            );
            return attempts;
          }
          if (key === 'device_fingerprint') {
            // Validate device fingerprint
            if (!value || value.length < 10) {
              console.warn('Invalid device fingerprint');
              return null;
            }
            return value;
          }
          return value;
        },
        transformOutput: (key, value, result, request) => {
          if (key === 'last_login' && result.success) {
            return new Date().toISOString();
          }
          return value;
        },
      }),
    ],
  };

  const adapter = createExpressAdapter(mockReAuth, config);

  // Now when any route is called:
  // 1. extractInputs will automatically extract cookies/headers based on context rules
  // 2. The step will execute with the extracted context
  // 3. handleStepResponse will automatically set cookies/headers based on context rules

  return adapter;
}

// Example 7: Testing the Express adapter's context system
export function testExpressAdapterContext() {
  const adapter = createDirectExpressAdapterWithContext();

  // The adapter now supports:

  // 1. Automatic OAuth cookie handling
  // POST /auth/google-oauth/start
  // - Will automatically set oauth_state and oauth_code_verifier cookies in response

  // POST /auth/google-oauth/callback
  // - Will automatically extract oauth_state and oauth_code_verifier from request cookies
  // - Will use them as inputs to the callback step

  // 2. Security context extraction
  // POST /auth/email-password/login
  // - Will extract x-forwarded-for and user-agent headers
  // - Will extract login_attempts and device_fingerprint cookies
  // - Will set x-auth-source header in response
  // - Will set last_login cookie if login successful

  // 3. All context extraction/setting happens automatically
  // - No need to manually handle cookies/headers in route handlers
  // - Plugin steps receive context as additional inputs
  // - Response context is set based on step outputs

  return adapter;
}

// Example configuration for real usage with context rules
export interface RealUsageConfig {
  reAuthEngine: ReAuthEngine;
  basePath?: string;
  cookieName?: string;
  includePlugins?: string[];
  excludePlugins?: string[];
}
