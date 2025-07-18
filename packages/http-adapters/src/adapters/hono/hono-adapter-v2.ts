import { type Context, Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type {
  ReAuthEngine,
  AuthOutput,
  Entity,
  AuthToken,
} from '@re-auth/reauth';
import {
  createHttpAdapter,
  type BaseHttpConfig,
  type FrameworkAdapter,
  type HttpAdapterContext,
  type RouteOverride,
  type CustomRoute,
  createRouteOverride,
  createCustomRoute,
  createAutoIntrospectionConfig,
  introspectReAuthEngine,
  findContextRules,
  type AutoGeneratedRoute,
  type AutoIntrospectionConfig,
  createContextRule,
  OAuth2ContextRules,
  type ContextExtractionRule,
} from '../../utils/http-adapter-factory';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Hono-specific configuration
 */
export interface HonoAdapterConfig extends BaseHttpConfig {
  // Hono-specific options can be added here
}

/**
 * Hono framework adapter implementation
 */
class HonoFrameworkAdapter implements FrameworkAdapter<HonoAdapterConfig> {
  private app: Hono;
  private engine?: ReAuthEngine;
  private contextRules: ContextExtractionRule[] = [];
  private adapterConfig: any = {};

  constructor(engine?: ReAuthEngine, app?: Hono) {
    this.app = app || new Hono();
    this.engine = engine;
  }

  /**
   * Set the ReAuth engine instance (for shared adapter pattern)
   */
  setEngine(engine: ReAuthEngine): void {
    this.engine = engine;
  }

  /**
   * Set context rules (for shared adapter pattern)
   */
  setContextRules(rules: ContextExtractionRule[]): void {
    this.contextRules = rules;
  }

  /**
   * Set adapter config (for shared adapter pattern)
   */
  setAdapterConfig(config: any): void {
    this.adapterConfig = config;
  }

  /**
   * Get expected inputs for a plugin step
   */
  private getExpectedInputs(pluginName: string, stepName: string): string[] {
    return this.engine?.getStepInputs?.(pluginName, stepName) || [];
  }

  setupMiddleware(context: HttpAdapterContext): void {
    // Store context rules and adapter config at instance level
    this.setContextRules(context.config.contextRules);
    this.setAdapterConfig({
      cookieName: context.config.cookieName || 'auth_token',
      cookieOptions: context.config.cookieOptions || {},
    });

    // Global middleware
    if (context.config.globalMiddleware) {
      for (const middleware of context.config.globalMiddleware) {
        this.app.use('*', middleware);
      }
    }

    // Auth middleware (much lighter without heavy context attachments)
    this.app.use('*', async (c, next) => {
      const token = this.extractToken(c);

      if (token) {
        try {
          const session = await context.engine.checkSession(token);
          if (session.valid && session.entity) {
            c.set('entity', session.entity);
            c.set('token', session.token);
            c.set('authenticated', true);
          } else {
            c.set('authenticated', false);
            c.set('entity', undefined);
            c.set('token', null);
            // clear cookie
            deleteCookie(c, this.adapterConfig.cookieName);
          }
        } catch (error) {
          console.warn('Invalid token:', error);
        }
      }

      if (!c.get('authenticated')) {
        c.set('authenticated', false);
      }

      await next();
    });
  }

  createRoute(
    method: string,
    path: string,
    handler: any,
    middleware: any[] = [],
  ): void {
    const honoMethod = method.toLowerCase() as keyof Hono;

    // No need to wrap handler for context attachment - everything is at adapter level now
    if (typeof this.app[honoMethod] === 'function') {
      if (middleware.length > 0) {
        (this.app[honoMethod] as any)(path, ...middleware, handler);
      } else {
        (this.app[honoMethod] as any)(path, handler);
      }
    }
  }

  async extractInputs(
    context: Context,
    pluginName: string,
    stepName: string,
  ): Promise<Record<string, any>> {
    // Get expected inputs from the shared engine instance instead of context
    const expectedInputs = this.getExpectedInputs?.(pluginName, stepName) || [];
    const inputs: Record<string, any> = {};

    // Extract from body
    try {
      const body = await context.req.json();
      // console.dir(body, { depth: null });
      // console.log('expectedInputs', expectedInputs);
      // biome-ignore lint/complexity/noForEach: <explanation>
      expectedInputs.forEach((inputName: string) => {
        if (body && body[inputName] !== undefined) {
          inputs[inputName] = body[inputName];
        }
      });
    } catch {
      // Not JSON body, ignore
    }

    // Extract from query
    // biome-ignore lint/complexity/noForEach: <explanation>
    expectedInputs.forEach((inputName: string) => {
      const queryValue = context.req.query(inputName);
      if (queryValue !== undefined) {
        inputs[inputName] = queryValue;
      }
    });

    // Extract from params
    // biome-ignore lint/complexity/noForEach: <explanation>
    expectedInputs.forEach((inputName: string) => {
      const paramValue = context.req.param(inputName);
      if (paramValue !== undefined) {
        inputs[inputName] = paramValue;
      }
    });

    if (expectedInputs.includes('token')) {
      console.log('token', expectedInputs);
      // Token from cookie or header
      const token = this.extractToken(context);
      console.log('token', token);
      if (token) {
        inputs.token = token;
      }
    }

    return inputs;
  }

  /**
   * Add configurable context inputs from cookies and headers based on context rules
   */
  addConfigurableContextInputs(
    context: Context,
    inputs: Record<string, any>,
    pluginName: string,
    stepName: string,
    contextRules: ContextExtractionRule[],
  ): void {
    // Use stored context rules instead of parameter (for compatibility)
    const rulesToUse =
      contextRules.length > 0 ? contextRules : this.contextRules;

    // Find applicable context extraction rules
    const applicableRules = findContextRules(pluginName, stepName, rulesToUse);

    // biome-ignore lint/complexity/noForEach: <explanation>
    applicableRules.forEach((rule) => {
      // Extract cookies
      if (rule.extractCookies) {
        // biome-ignore lint/complexity/noForEach: <explanation>
        rule.extractCookies.forEach((cookieName) => {
          const cookieValue = getCookie(context, cookieName);
          if (cookieValue) {
            let value = cookieValue;

            // Apply transform if provided
            if (rule.transformInput) {
              value = rule.transformInput(cookieName, value, context);
            }

            inputs[cookieName] = value;
          }
        });
      }

      // Extract headers
      if (rule.extractHeaders) {
        const headerConfig = rule.extractHeaders;

        if (Array.isArray(headerConfig)) {
          // Simple array format: ['header-name']
          // biome-ignore lint/complexity/noForEach: <explanation>
          headerConfig.forEach((headerName) => {
            const headerValue = context.req.header(headerName);
            if (headerValue) {
              let value = headerValue;

              // Apply transform if provided
              if (rule.transformInput) {
                value = rule.transformInput(headerName, value, context);
              }

              inputs[headerName.replace(/-/g, '_')] = value; // Convert header-name to header_name
            }
          });
        } else {
          // Object format: { 'header-name': 'inputName' }
          // biome-ignore lint/complexity/noForEach: <explanation>
          Object.entries(headerConfig).forEach(([headerName, inputName]) => {
            const headerValue = context.req.header(headerName);
            if (headerValue) {
              let value = headerValue;

              // Apply transform if provided
              if (rule.transformInput) {
                value = rule.transformInput(inputName, value, context);
              }

              inputs[inputName] = value;
            }
          });
        }
      }
    });
  }

  handleStepResponse(
    context: Context,
    response: any, // Not used in Hono, context handles response
    result: AuthOutput,
    httpConfig: any,
  ): Response {
    const { redirect, success, status, cookies, ...data } = result;

    // Handle token (set cookie) using stored adapter config
    if (data.token) {
      setCookie(
        context,
        this.adapterConfig.cookieName,
        data.token,
        this.adapterConfig.cookieOptions,
      );
    }

    // Handle additional cookies from result.cookies
    if (cookies) {
      for (const [name, value] of Object.entries(cookies)) {
        setCookie(context, name, value as string);
      }
    }

    // Handle redirect
    if (redirect) {
      return context.redirect(redirect);
    }

    // Determine status code
    const statusCode = this.getStatusCode(result, httpConfig);

    // Send response
    return context.json(
      {
        success,
        status,
        ...data,
      },
      statusCode,
    );
  }

  /**
   * Handle configurable context outputs (set cookies and headers) based on context rules
   */
  handleConfigurableContextOutputs(
    context: Context,
    response: any, // Not used in Hono
    result: AuthOutput,
    pluginName: string,
    stepName: string,
    contextRules: ContextExtractionRule[],
  ): void {
    // Use stored context rules instead of parameter (for compatibility)
    const rulesToUse =
      contextRules.length > 0 ? contextRules : this.contextRules;

    // Find applicable context extraction rules
    const applicableRules = findContextRules(pluginName, stepName, rulesToUse);

    for (const rule of applicableRules) {
      // Set cookies from result
      if (rule.setCookies) {
        for (const cookieName of rule.setCookies) {
          if (result[cookieName] !== undefined) {
            let value = result[cookieName];

            // Apply transform if provided
            if (rule.transformOutput) {
              value = rule.transformOutput(cookieName, value, result, context);
            }

            // Handle complex cookie options
            if (
              typeof value === 'object' &&
              value !== null &&
              'value' in value
            ) {
              // Value is a cookie options object
              const { value: cookieValue, ...cookieOptions } = value;
              setCookie(context, cookieName, cookieValue, cookieOptions);
            } else {
              // Simple value
              setCookie(context, cookieName, value);
            }
          }
        }
      }

      // Set headers from result
      if (rule.setHeaders) {
        const headerConfig = rule.setHeaders;

        if (Array.isArray(headerConfig)) {
          // Simple array format: ['header-name']
          for (const headerName of headerConfig) {
            const inputName = headerName.replace(/-/g, '_'); // Convert header-name to header_name
            if (result[inputName] !== undefined) {
              let value = result[inputName];

              // Apply transform if provided
              if (rule.transformOutput) {
                value = rule.transformOutput(
                  headerName,
                  value,
                  result,
                  context,
                );
              }

              context.header(headerName, value);
            }
          }
        } else {
          // Object format: { 'header-name': 'resultKey' }
          for (const [headerName, resultKey] of Object.entries(headerConfig)) {
            if (result[resultKey] !== undefined) {
              let value = result[resultKey];

              // Apply transform if provided
              if (rule.transformOutput) {
                value = rule.transformOutput(
                  headerName,
                  value,
                  result,
                  context,
                );
              }

              context.header(headerName, value);
            }
          }
        }
      }
    }
  }

  private getStatusCode(
    result: AuthOutput,
    httpConfig: any,
  ): ContentfulStatusCode {
    // First, check if the plugin step defines a specific status code for the result status
    if (result.status && httpConfig[result.status]) {
      return httpConfig[result.status];
    }

    // Fallback to generic success/error codes from httpConfig
    if (result.success && httpConfig.success) {
      return httpConfig.success;
    }
    if (!result.success && httpConfig.error) {
      return httpConfig.error;
    }

    // Fallback to standard HTTP status codes based on result.status
    if (result.status === 'redirect') return 302;
    if (result.status === 'unauthorized') return 401;
    if (result.status === 'forbidden') return 403;
    if (result.status === 'not_found') return 404;
    if (result.status === 'conflict') return 409;
    if (result.status === 'error') return 400;

    // Default fallback
    return result.success ? 200 : 400;
  }

  extractToken(context: Context): string | null {
    // From cookie
    const cookieToken = getCookie(context, this.adapterConfig.cookieName);
    if (cookieToken) {
      return cookieToken;
    }

    // From Authorization header
    const authHeader = context.req.header('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }

  requireAuth(): any {
    return async (c: Context, next: any) => {
      if (!c.get('authenticated')) {
        return c.json({ error: 'Authentication required' }, 401);
      }
      await next();
    };
  }

  errorResponse(context: any, error: Error): Response {
    console.error('HTTP Adapter Error:', error);
    return context.request.json(
      {
        success: false,
        message: error.message || 'Internal server error',
        error: process.env.NODE_ENV !== 'production' ? error : undefined,
      },
      500,
    );
  }

  getAdapter(): Hono {
    return this.app;
  }
}

/**
 * Create Hono adapter using the factory pattern with shared instance
 */
export const createHonoAdapterV2 = (
  engine: ReAuthEngine,
  config: HonoAdapterConfig,
  frameworkAdapter: HonoFrameworkAdapter,
) => {
  return createHttpAdapter(frameworkAdapter)(engine, config);
};

/**
 * Hono adapter class with additional features
 */
export class HonoAdapterV2 {
  private app: Hono;
  private engine: ReAuthEngine;
  private config: HonoAdapterConfig;
  private frameworkAdapter: HonoFrameworkAdapter;

  constructor(
    engine: ReAuthEngine,
    // biome-ignore lint/style/useDefaultParameterLast: <explanation>
    config: HonoAdapterConfig = {},
    app: Hono,
    frameworkAdapter?: HonoFrameworkAdapter,
  ) {
    this.engine = engine;
    this.config = config;
    this.frameworkAdapter =
      frameworkAdapter || new HonoFrameworkAdapter(engine, app);
    // Set the engine on the shared adapter before creating the HTTP adapter
    this.frameworkAdapter.setEngine(engine);
    // Create the app using the factory
    createHonoAdapterV2(engine, config, this.frameworkAdapter);
    this.app = this.frameworkAdapter.getAdapter();

    // No need for middleware to attach config - it's stored at adapter level now
  }

  /**
   * Get the Hono app
   */
  getApp(): Hono {
    return this.app;
  }

  getAdapter(): HonoFrameworkAdapter {
    return this.frameworkAdapter;
  }

  /**
   * Add a custom route
   */
  addRoute(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    handler: (c: Context) => Promise<Response> | Response,
    options: {
      middleware?: any[];
      requireAuth?: boolean;
    } = {},
  ): void {
    const middleware = options.middleware || [];

    if (options.requireAuth) {
      middleware.push(this.frameworkAdapter.requireAuth());
    }

    const honoMethod = method.toLowerCase() as keyof Hono;
    if (typeof this.app[honoMethod] === 'function') {
      if (middleware.length > 0) {
        (this.app[honoMethod] as any)(path, ...middleware, handler);
      } else {
        (this.app[honoMethod] as any)(path, handler);
      }
    }
  }

  /**
   * Protection middleware for routes
   */
  protect(options: ProtectOptions = {}) {
    return async (c: Context, next: any) => {
      // Check authentication
      if (!c.get('authenticated')) {
        return c.json({ error: 'Authentication required' }, 401);
      }

      // Check roles
      if (options.roles && options.roles.length > 0) {
        const entity = c.get('entity') as Entity;
        const userRole = entity?.role;
        if (!userRole || !options.roles.includes(userRole)) {
          return c.json({ error: 'Insufficient permissions' }, 403);
        }
      }

      // Custom authorization
      if (options.authorize) {
        try {
          const entity = c.get('entity') as Entity;
          const isAuthorized = await options.authorize(entity, c);
          if (!isAuthorized) {
            return c.json({ error: 'Access denied' }, 403);
          }
        } catch (error) {
          console.error('Authorization error:', error);
          return c.json({ error: 'Authorization check failed' }, 500);
        }
      }

      await next();
    };
  }
}

declare module 'hono' {
  interface ContextVariableMap {
    // Lightweight context variables - no heavy objects attached
    entity?: Entity;
    authenticated: boolean;
    token: AuthToken;
  }
}

/**
 * Protection options
 */
interface ProtectOptions {
  roles?: string[];
  authorize?: (entity: Entity, context: Context) => Promise<boolean> | boolean;
}

/**
 * Convenience function to create Hono adapter with options
 */
export function createHonoAdapter(
  engine: ReAuthEngine,
  // biome-ignore lint/style/useDefaultParameterLast: <explanation>
  config: HonoAdapterConfig = {},
  app: Hono,
): HonoAdapterV2 {
  return new HonoAdapterV2(engine, config, app);
}

// Export utility functions
export {
  createRouteOverride,
  createCustomRoute,
  createAutoIntrospectionConfig,
  introspectReAuthEngine,
  createContextRule,
  OAuth2ContextRules,
  HonoFrameworkAdapter,
};

export type {
  RouteOverride,
  CustomRoute,
  AutoGeneratedRoute,
  AutoIntrospectionConfig,
  ContextExtractionRule,
};
