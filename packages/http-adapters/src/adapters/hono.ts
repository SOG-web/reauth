import type {
  HttpAdapterConfig,
  FrameworkAdapter,
  HttpRequest,
  HttpResponse,
  AuthenticatedUser,
} from '../types.js';
import { ReAuthHttpAdapter } from '../base-adapter.js';
import { Hono } from 'hono';

export class HonoAdapter {
  public readonly name = 'hono';
  private adapter: ReAuthHttpAdapter;

  constructor(config: HttpAdapterConfig) {
    this.adapter = new ReAuthHttpAdapter(config);
  }

  /**
   * Create Hono middleware
   */
  createMiddleware() {
    return async (c: any, next: any) => {
      // Add adapter to context for access in route handlers
      c.set('reauth', this.adapter);
      await next();
    };
  }

  /**
   * Create Hono user middleware that populates c.get('user')
   */
  createUserMiddleware() {
    return async (c: any, next: any) => {
      try {
        const httpReq = this.extractRequest(c);
        const user = await this.adapter.getCurrentUser(httpReq);
        c.set('user', user);
      } catch (error) {
        // Don't fail the request if user lookup fails
        c.set('user', null);
      }
      await next();
    };
  }

  /**
   * Get current user from Hono context
   */
  async getCurrentUser(c: any): Promise<AuthenticatedUser | null> {
    // If user is already populated by middleware, return it
    const user = c.get('user');
    if (user !== undefined) {
      return user;
    }

    // Otherwise, check session
    const httpReq = this.extractRequest(c);
    return await this.adapter.getCurrentUser(httpReq);
  }

  /**
   * Extract HTTP request from Hono context
   */
  extractRequest(c: any): HttpRequest {
    const url = new URL(c.req.url);

    return {
      method: c.req.method,
      url: c.req.url,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      params: c.req.param() as Record<string, string>,
      body: {},
      headers: c.req.raw.headers
        ? Object.fromEntries(c.req.raw.headers.entries())
        : {},
      cookies: {},
      ip:
        c.env?.CF_CONNECTING_IP ||
        c.req.header('x-forwarded-for') ||
        c.req.header('x-real-ip'),
      userAgent: c.req.header('user-agent'),
    };
  }

  /**
   * Send response using Hono context
   */
  sendResponse(c: any, data: any, statusCode: number = 200): void {
    c.status(statusCode as any);
    c.json(data);
  }

  /**
   * Handle error using Hono context
   */
  handleError(c: any, error: Error, statusCode: number = 500): void {
    c.status(statusCode as any);
    c.json({
      success: false,
      error: {
        code: 'ERROR',
        message: error.message,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Create Hono app with all ReAuth routes
   */
  createApp(): any {
    const app = new Hono();

    // Add middleware
    app.use('*', this.createMiddleware());

    // Authentication step routes
    app.post('/auth/:plugin/:step', this.createStepHandler());
    app.get('/auth/:plugin/:step', this.createStepHandler());
    app.put('/auth/:plugin/:step', this.createStepHandler());
    app.patch('/auth/:plugin/:step', this.createStepHandler());
    app.delete('/auth/:plugin/:step', this.createStepHandler());

    // Session management routes
    app.get('/session', this.createSessionCheckHandler());
    app.post('/session', this.createSessionCreateHandler());
    app.delete('/session', this.createSessionDestroyHandler());

    // Plugin introspection routes
    app.get('/plugins', this.createPluginListHandler());
    app.get('/plugins/:plugin', this.createPluginDetailsHandler());

    // Introspection and health
    app.get('/introspection', this.createIntrospectionHandler());
    app.get('/health', this.createHealthHandler());

    return app;
  }

  /**
   * Register routes on existing Hono app
   */
  registerRoutes(app: any, basePath: string = ''): void {
    // Add middleware
    app.use(`${basePath}/*`, this.createMiddleware());

    // Authentication step routes
    app.post(`${basePath}/auth/:plugin/:step`, this.createStepHandler());
    app.get(`${basePath}/auth/:plugin/:step`, this.createStepHandler());
    app.put(`${basePath}/auth/:plugin/:step`, this.createStepHandler());
    app.patch(`${basePath}/auth/:plugin/:step`, this.createStepHandler());
    app.delete(`${basePath}/auth/:plugin/:step`, this.createStepHandler());

    // Session management routes
    app.get(`${basePath}/session`, this.createSessionCheckHandler());
    app.post(`${basePath}/session`, this.createSessionCreateHandler());
    app.delete(`${basePath}/session`, this.createSessionDestroyHandler());

    // Plugin introspection routes
    app.get(`${basePath}/plugins`, this.createPluginListHandler());
    app.get(`${basePath}/plugins/:plugin`, this.createPluginDetailsHandler());

    // Introspection and health
    app.get(`${basePath}/introspection`, this.createIntrospectionHandler());
    app.get(`${basePath}/health`, this.createHealthHandler());
  }

  /**
   * Create step execution handler
   */
  private createStepHandler() {
    return async (c: any) => {
      try {
        const httpReq = this.extractRequest(c);

        // Parse body for POST/PUT/PATCH requests
        if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
          try {
            httpReq.body = await c.req.json();
          } catch {
            httpReq.body = {};
          }
        }

        const result = await this.adapter.executeAuthStep(httpReq as any);
        return c.json(result);
      } catch (error) {
        return this.handleErrorResponse(c, error as Error);
      }
    };
  }

  /**
   * Create session check handler
   */
  private createSessionCheckHandler() {
    return async (c: any) => {
      try {
        const httpReq = this.extractRequest(c);
        const result = await this.adapter.checkSession(httpReq as any);
        return c.json(result);
      } catch (error) {
        return this.handleErrorResponse(c, error as Error);
      }
    };
  }

  /**
   * Create session creation handler
   */
  private createSessionCreateHandler() {
    return async (c: any) => {
      try {
        const httpReq = this.extractRequest(c);
        try {
          httpReq.body = await c.req.json();
        } catch {
          httpReq.body = {};
        }

        const result = await this.adapter.createSession(httpReq as any);
        c.status(201 as any);
        return c.json(result);
      } catch (error) {
        return this.handleErrorResponse(c, error as Error);
      }
    };
  }

  /**
   * Create session destruction handler
   */
  private createSessionDestroyHandler() {
    return async (c: any) => {
      try {
        const httpReq = this.extractRequest(c);
        const result = await this.adapter.destroySession(httpReq as any);
        return c.json(result);
      } catch (error) {
        return this.handleErrorResponse(c, error as Error);
      }
    };
  }

  /**
   * Create plugin list handler
   */
  private createPluginListHandler() {
    return async (c: any) => {
      try {
        const result = await this.adapter.listPlugins();
        return c.json(result);
      } catch (error) {
        return this.handleErrorResponse(c, error as Error);
      }
    };
  }

  /**
   * Create plugin details handler
   */
  private createPluginDetailsHandler() {
    return async (c: any) => {
      try {
        const plugin = c.req.param('plugin');
        const result = await this.adapter.getPlugin(plugin);
        return c.json(result);
      } catch (error) {
        return this.handleErrorResponse(c, error as Error);
      }
    };
  }

  /**
   * Create introspection handler
   */
  private createIntrospectionHandler() {
    return async (c: any) => {
      try {
        const result = await this.adapter.getIntrospection();
        return c.json(result);
      } catch (error) {
        return this.handleErrorResponse(c, error as Error);
      }
    };
  }

  /**
   * Create health check handler
   */
  private createHealthHandler() {
    return async (c: any) => {
      try {
        const result = await this.adapter.healthCheck();
        return c.json(result);
      } catch (error) {
        return this.handleErrorResponse(c, error as Error);
      }
    };
  }

  /**
   * Handle error response
   */
  private handleErrorResponse(c: any, error: Error) {
    c.status(500 as any);
    return c.json({
      success: false,
      error: {
        code: 'ERROR',
        message: error.message,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Get the base adapter instance
   */
  getAdapter(): ReAuthHttpAdapter {
    return this.adapter;
  }
}

/**
 * Factory function to create Hono adapter
 */
export function createHonoAdapter(config: HttpAdapterConfig): HonoAdapter {
  return new HonoAdapter(config);
}

/**
 * Hono middleware factory function
 */
export function honoReAuth(config: HttpAdapterConfig): any {
  const adapter = new HonoAdapter(config);
  return adapter.createMiddleware();
}
