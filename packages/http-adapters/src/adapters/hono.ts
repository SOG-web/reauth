import type {
  HttpAdapterConfig,
  HttpRequest,
  AuthenticatedUser,
} from '../types';
import { ReAuthHttpAdapter } from '../base-adapter';
import { Context, Hono } from 'hono';
import { setCookie } from 'hono/cookie';

export class HonoAdapter {
  public readonly name = 'hono';
  private adapter: ReAuthHttpAdapter;
  private config: HttpAdapterConfig;

  constructor(config: HttpAdapterConfig) {
    this.adapter = new ReAuthHttpAdapter(config);
    this.config = config;
  }

  /**
   * Create Hono user middleware that populates c.get('user')
   */
  createUserMiddleware() {
    return async (c: Context, next: any) => {
      try {
        const httpReq = this.extractRequest(c);
        const user = await this.adapter.getCurrentUser(httpReq);
        c.set('user', user);
        c.set('authenticated', !!user);
      } catch (error) {
        // Don't fail the request if user lookup fails
        c.set('user', null);
        c.set('authenticated', false);
      }
      await next();
    };
  }

  /**
   * Get current user from Hono context
   */
  async getCurrentUser(c: Context): Promise<AuthenticatedUser | null> {
    // If user is already populated by middleware, return it
    const user = c.get('user');
    if (user !== undefined) {
      return user;
    }

    // Otherwise, check session
    const httpReq = this.extractRequest(c);
    const u = await this.adapter.getCurrentUser(httpReq);

    // Store in context for future use
    c.set('user', u);
    c.set('authenticated', !!u);
    return u;
  }

  /**
   * Extract HTTP request from Hono context
   */
  extractRequest(c: Context): HttpRequest {
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
  handleError(c: Context, error: Error, statusCode: number = 500): void {
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
   * Register routes on existing Hono app
   */
  registerRoutes(
    app: Hono,
    basePath: string = '',
    exposeIntrospection: boolean = false,
  ): void {
    // Introspection and health
    if (exposeIntrospection) {
      // Plugin introspection routes
      app.get(`${basePath}/plugins`, this.createPluginListHandler());
      app.get(`${basePath}/plugins/:plugin`, this.createPluginDetailsHandler());
      app.get(`${basePath}/introspection`, this.createIntrospectionHandler());
    }
    app.get(`${basePath}/health`, this.createHealthHandler());

    // Session management routes
    app.get(`${basePath}/session`, this.createSessionCheckHandler());

    // Authentication step routes
    app.post(`${basePath}/:plugin/:step`, this.createStepHandler());
    app.get(`${basePath}/:plugin/:step`, this.createStepHandler());
    app.put(`${basePath}/:plugin/:step`, this.createStepHandler());
    app.patch(`${basePath}/:plugin/:step`, this.createStepHandler());
    app.delete(`${basePath}/:plugin/:step`, this.createStepHandler());
  }

  /**
   * Create step execution handler
   */
  private createStepHandler() {
    return async (c: Context) => {
      try {
        const httpReq = this.extractRequest(c);

        // parse cookies
        const cookieHeader = c.req.header('cookie');
        if (cookieHeader) {
          const cookies: Record<string, string> = {};
          cookieHeader.split(';').forEach((cookie) => {
            const parts = cookie.split('=');
            const key = parts.shift()?.trim();
            const value = decodeURIComponent(parts.join('='));
            if (key) {
              cookies[key] = value;
            }
          });
          httpReq.cookies = cookies;
        }

        // Parse body for POST/PUT/PATCH requests
        if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
          try {
            httpReq.body = await c.req.json();
          } catch {
            httpReq.body = {};
          }
        }

        const result = await this.adapter.executeAuthStep(httpReq as any);

        if (this.config.cookie) {
          const cookie = this.config.cookie;
          const options = cookie.options;
          if (result.data?.token) {
            // Set cookies in response
            const token = result.data.token;
            if (typeof token === 'string') {
              setCookie(c, cookie.name, token, {
                domain: options.domain,
                httpOnly: options.httpOnly,
                secure: options.secure,
                path: options.path || '/',
                sameSite: options.sameSite || 'Lax',
                partitioned: options.partitioned,
                maxAge: options.maxAge,
                expires: options.expires,
                prefix: options.prefix,
                priority: options.priority,
              });
            } else {
              setCookie(c, cookie.name, token.accessToken, {
                domain: options.domain,
                httpOnly: options.httpOnly,
                secure: options.secure,
                path: options.path || '/',
                sameSite: options.sameSite || 'Lax',
                partitioned: options.partitioned,
                maxAge: options.maxAge,
                expires: options.expires,
                prefix: options.prefix,
                priority: options.priority,
              });

              if (cookie.refreshOptions && token.refreshToken) {
                const refreshOptions = cookie.refreshOptions;
                setCookie(
                  c,
                  cookie.refreshTokenName || 'refreshToken',
                  token.refreshToken,
                  {
                    domain: refreshOptions.domain,
                    httpOnly: refreshOptions.httpOnly,
                    secure: refreshOptions.secure,
                    path: refreshOptions.path || '/',
                    sameSite: refreshOptions.sameSite || 'Lax',
                    partitioned: refreshOptions.partitioned,
                    maxAge: refreshOptions.maxAge,
                    expires: refreshOptions.expires,
                    prefix: refreshOptions.prefix,
                    priority: refreshOptions.priority,
                  },
                );
              }
            }
          }
        }

        return c.json(result, result.status as any);
      } catch (error) {
        return this.handleErrorResponse(c, error as Error);
      }
    };
  }

  /**
   * Create session check handler
   */
  private createSessionCheckHandler() {
    return async (c: Context) => {
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
   * Create plugin list handler
   */
  private createPluginListHandler() {
    return async (c: Context) => {
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
    return async (c: Context) => {
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
    return async (c: Context) => {
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
    return async (c: Context) => {
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
  private handleErrorResponse(c: Context, error: Error) {
    c.status(500);
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
 * Hono middleware factory function
 */
export function honoReAuth(config: HttpAdapterConfig): HonoAdapter {
  const adapter = new HonoAdapter(config);
  return adapter;
}

declare module 'hono' {
  interface ContextVariableMap {
    // Lightweight context variables - no heavy objects attached
    user?: AuthenticatedUser | null;
    authenticated: boolean;
  }
}
