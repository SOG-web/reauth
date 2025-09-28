import type {
  HttpAdapterConfig,
  HttpRequest,
  HttpResponse,
  AuthenticatedUser,
} from '../types.js';
import { ReAuthHttpAdapter } from '../base-adapter.js';
import { AutoRouter } from 'itty-router';

export class IttyRouterAdapter {
  public readonly name = 'itty-router';
  private adapter: ReAuthHttpAdapter;
  private config: HttpAdapterConfig;

  constructor(config: HttpAdapterConfig) {
    this.adapter = new ReAuthHttpAdapter(config);
    this.config = config;
  }

  /**
   * Create itty-router user middleware that populates request.user
   */
  createUserMiddleware() {
    return async (request: Request, env: any, ctx: any) => {
      try {
        const httpReq = this.extractRequest(request);
        const user = await this.adapter.getCurrentUser(httpReq);
        (request as any).user = user;
        (request as any).authenticated = !!user;
      } catch (error) {
        // Don't fail the request if user lookup fails
        (request as any).user = null;
        (request as any).authenticated = false;
      }
    };
  }

  /**
   * Get current user from request
   */
  async getCurrentUser(request: Request): Promise<AuthenticatedUser | null> {
    // If user is already populated by middleware, return it
    const user = (request as any).user;
    if (user !== undefined) {
      return user;
    }

    // Otherwise, check session
    const httpReq = this.extractRequest(request);
    const u = await this.adapter.getCurrentUser(httpReq);

    // Store in request for future use
    (request as any).user = u;
    (request as any).authenticated = !!u;
    return u;
  }

  /**
   * Extract HTTP request from itty-router Request
   */
  extractRequest(request: Request): HttpRequest {
    const url = new URL(request.url);

    // Parse cookies from header
    const cookies: Record<string, string> = {};
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      cookieHeader.split(';').forEach((cookie) => {
        const parts = cookie.split('=');
        const key = parts.shift()?.trim();
        const value = decodeURIComponent(parts.join('='));
        if (key) {
          cookies[key] = value;
        }
      });
    }

    return {
      method: request.method,
      url: request.url,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      params: {}, // Will be populated by router
      body: {},
      headers: Object.fromEntries(request.headers.entries()),
      cookies,
      ip: request.headers.get('cf-connecting-ip') ||
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    };
  }

  /**
   * Send response using Response
   */
  sendResponse(data: any, statusCode: number = 200, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(data), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });
  }

  /**
   * Handle error using Response
   */
  handleError(error: Error, statusCode: number = 500): Response {
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'ERROR',
        message: error.message,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    }), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Register routes on existing itty-router AutoRouter
   */
  registerRoutes(
    router: any,
    basePath: string = '',
    exposeIntrospection: boolean = false,
  ): void {
    // Introspection and health
    if (exposeIntrospection) {
      // Plugin introspection routes
      router.get(`${basePath}/plugins`, this.createPluginListHandler());
      router.get(`${basePath}/plugins/:plugin`, this.createPluginDetailsHandler());
      router.get(`${basePath}/introspection`, this.createIntrospectionHandler());
    }
    router.get(`${basePath}/health`, this.createHealthHandler());

    // Session management routes
    router.get(`${basePath}/session`, this.createSessionCheckHandler());

    // Authentication step routes
    router.post(`${basePath}/:plugin/:step`, this.createStepHandler());
    router.get(`${basePath}/:plugin/:step`, this.createStepHandler());
    router.put(`${basePath}/:plugin/:step`, this.createStepHandler());
    router.patch(`${basePath}/:plugin/:step`, this.createStepHandler());
    router.delete(`${basePath}/:plugin/:step`, this.createStepHandler());
  }

  /**
   * Create step execution handler
   */
  private createStepHandler() {
    return async (request: Request, env: any, ctx: any) => {
      try {
        const httpReq = this.extractRequest(request);

        // Populate params from router
        httpReq.params = (request as any).params || {};

        // Parse body for POST/PUT/PATCH requests
        if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
          try {
            httpReq.body = await request.json();
          } catch {
            httpReq.body = {};
          }
        }

        const result = await this.adapter.executeAuthStep(httpReq as any);

        // Handle cookies
        const headers: Record<string, string> = {};
        if (this.config.cookie && result.data?.token) {
          const cookie = this.config.cookie;
          const options = cookie.options;
          const token = result.data.token;

          if (typeof token === 'string') {
            headers['Set-Cookie'] = this.createCookieHeader(cookie.name, token, options);
          } else {
            headers['Set-Cookie'] = this.createCookieHeader(cookie.name, token.accessToken, options);

            if (cookie.refreshOptions && token.refreshToken) {
              const refreshOptions = cookie.refreshOptions;
              const refreshCookie = this.createCookieHeader(
                cookie.refreshTokenName || 'refreshToken',
                token.refreshToken,
                refreshOptions
              );
              headers['Set-Cookie'] += '; ' + refreshCookie;
            }
          }
        }

        return this.sendResponse(result, result.status, headers);
      } catch (error) {
        return this.handleError(error as Error);
      }
    };
  }

  /**
   * Create session check handler
   */
  private createSessionCheckHandler() {
    return async (request: Request) => {
      try {
        const httpReq = this.extractRequest(request);
        const result = await this.adapter.checkSession(httpReq as any);
        return this.sendResponse(result);
      } catch (error) {
        return this.handleError(error as Error);
      }
    };
  }

  /**
   * Create plugin list handler
   */
  private createPluginListHandler() {
    return async () => {
      try {
        const result = await this.adapter.listPlugins();
        return this.sendResponse(result);
      } catch (error) {
        return this.handleError(error as Error);
      }
    };
  }

  /**
   * Create plugin details handler
   */
  private createPluginDetailsHandler() {
    return async (request: Request) => {
      try {
        const params = (request as any).params || {};
        const plugin = params.plugin;
        const result = await this.adapter.getPlugin(plugin);
        return this.sendResponse(result);
      } catch (error) {
        return this.handleError(error as Error);
      }
    };
  }

  /**
   * Create introspection handler
   */
  private createIntrospectionHandler() {
    return async () => {
      try {
        const result = await this.adapter.getIntrospection();
        return this.sendResponse(result);
      } catch (error) {
        return this.handleError(error as Error);
      }
    };
  }

  /**
   * Create health check handler
   */
  private createHealthHandler() {
    return async () => {
      try {
        const result = await this.adapter.healthCheck();
        return this.sendResponse(result);
      } catch (error) {
        return this.handleError(error as Error);
      }
    };
  }

  /**
   * Create cookie header string
   */
  private createCookieHeader(name: string, value: string, options: any): string {
    let cookie = `${name}=${encodeURIComponent(value)}`;

    if (options.path) cookie += `; Path=${options.path}`;
    if (options.domain) cookie += `; Domain=${options.domain}`;
    if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
    if (options.expires) cookie += `; Expires=${options.expires.toUTCString()}`;
    if (options.httpOnly) cookie += '; HttpOnly';
    if (options.secure) cookie += '; Secure';
    if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
    if (options.partitioned) cookie += '; Partitioned';

    return cookie;
  }

  /**
   * Get the base adapter instance
   */
  getAdapter(): ReAuthHttpAdapter {
    return this.adapter;
  }
}

/**
 * itty-router middleware factory function
 */
export function ittyRouterReAuth(config: HttpAdapterConfig): IttyRouterAdapter {
  const adapter = new IttyRouterAdapter(config);
  return adapter;
}