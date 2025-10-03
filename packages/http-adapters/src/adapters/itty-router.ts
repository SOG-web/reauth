import type {
  HttpAdapterConfig,
  HttpRequest,
  HttpResponse,
  AuthenticatedUser,
} from '../types.js';
import { ReAuthHttpAdapter } from '../base-adapter.js';
import {
  AutoRouter,
  AutoRouterType,
  IRequest,
  json,
  error,
  cors,
  CorsOptions,
} from 'itty-router';
export class IttyRouterAdapter {
  public readonly name = 'itty-router';
  private adapter: ReAuthHttpAdapter;
  private config: HttpAdapterConfig;
  private generateDeviceInfo?: (
    request: IRequest,
  ) => Promise<Record<string, any>>;
  private routePaths: string[] = [];

  constructor(
    config: HttpAdapterConfig,
    generateDeviceInfo?: (request: IRequest) => Promise<Record<string, any>>,
  ) {
    this.adapter = new ReAuthHttpAdapter(config);
    this.config = config;
    this.generateDeviceInfo = generateDeviceInfo;
  }

  /**
   * Create a new AutoRouter with CORS configured
   */
  createRouter(
    basePath: string = '',
    exposeIntrospection: boolean = false,
    corsOptions?: CorsOptions,
  ): AutoRouterType {
    const router = AutoRouter();

    // Configure CORS if options provided
    if (corsOptions !== undefined) {
      this.configureCORS(router, corsOptions);
    }

    // Register routes
    return this.registerRoutes(router, basePath, exposeIntrospection);
  }
  /**
   * Register middleware on an existing router
   */
  registerMiddleware(
    router: AutoRouterType,
    middleware: {
      before?: any[];
      finally?: any[];
    },
  ): void {
    // Add before middleware
    if (middleware.before) {
      if (router.before) {
        router.before.push(...middleware.before);
      } else {
        router.before = [...middleware.before];
      }
    }

    // Add finally middleware
    if (middleware.finally) {
      if (router.finally) {
        router.finally.push(...middleware.finally);
      } else {
        router.finally = [...middleware.finally];
      }
    }
  }

  /**
   * Configure CORS on an existing router
   */
  configureCORS(router: AutoRouterType, options?: CorsOptions): void {
    const { preflight, corsify } = cors(options);

    // Add preflight to the beginning of the middleware chain
    if (router.before) {
      router.before.unshift(preflight);
    } else {
      router.before = [preflight];
    }

    // Add corsify to the end of the middleware chain
    if (router.finally) {
      router.finally.push(corsify);
    } else {
      router.finally = [corsify];
    }
  }

  createUserMiddleware() {
    return async (request: IRequest) => {
      try {
        const httpReq = this.extractRequest(request);
        const deviceInfo = await this.generateDeviceInfoInternal(request);
        const user = await this.adapter.getCurrentUser(httpReq, deviceInfo);
        request.user = user;
        request.authenticated = !!user;
      } catch (error) {
        // Don't fail the request if user lookup fails
        request.user = null;
        request.authenticated = false;
      }
    };
  }

  async generateDeviceInfoInternal(request: IRequest) {
    if (!this.generateDeviceInfo) {
      return {};
    }

    const deviceInfo = await this.generateDeviceInfo(request);
    return deviceInfo;
  }

  /**
   * Get current user from request
   */
  async getCurrentUser(request: IRequest): Promise<AuthenticatedUser | null> {
    // If user is already populated by middleware, return it
    const user = request.user;
    if (user !== undefined) {
      return user;
    }

    // Otherwise, check session
    const httpReq = this.extractRequest(request);
    const deviceInfo = await this.generateDeviceInfoInternal(request);
    const u = await this.adapter.getCurrentUser(httpReq, deviceInfo);

    // Store in request for future use
    request.user = u;
    request.authenticated = !!u;
    return u;
  }

  /**
   * Extract HTTP request from itty-router Request
   */
  extractRequest(request: IRequest): HttpRequest {
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
      query: request.query,
      params: {}, // Will be populated by router
      body: {},
      headers: Object.fromEntries(request.headers.entries()),
      cookies,
      ip:
        request.headers.get('cf-connecting-ip') ||
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    };
  }

  /**
   * Send response using Response
   */
  sendResponse(
    data: any,
    statusCode: number = 200,
    headers: Record<string, string> = {},
  ): Response {
    return json(data, { status: statusCode, headers });
  }

  /**
   * Handle error using Response
   */
  handleError(err: Error, statusCode: number = 500): Response {
    return error(statusCode, {
      success: false,
      error: {
        code: 'ERROR',
        message: err.message,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Register routes on existing itty-router AutoRouter or create a new one
   */
  registerRoutes(
    router?: AutoRouterType,
    basePath: string = '',
    exposeIntrospection: boolean = false,
  ): AutoRouterType {
    // Create a new router if none provided
    const targetRouter = router || AutoRouter();

    // Introspection and health
    if (exposeIntrospection) {
      targetRouter.get(`${basePath}/plugins`, this.createPluginListHandler());
      targetRouter.get(
        `${basePath}/plugins/:plugin`,
        this.createPluginDetailsHandler(),
      );
      targetRouter.get(
        `${basePath}/introspection`,
        this.createIntrospectionHandler(),
      );
    }
    targetRouter.get(`${basePath}/health`, this.createHealthHandler());

    // Session management routes
    targetRouter.get(`${basePath}/session`, this.createSessionCheckHandler());

    // Authentication step routes - get all endpoints and register them
    const endpoints = this.adapter.getEndpoints();
    for (const endpoint of endpoints) {
      const routePath = `${basePath}${endpoint.path}`;
      const handler = this.createStepHandler(
        endpoint.pluginName,
        endpoint.stepName,
      );

      this.routePaths.push(routePath);

      switch (endpoint.method) {
        case 'POST':
          targetRouter.post(routePath, handler);
          break;
        case 'GET':
          targetRouter.get(routePath, handler);
          break;
        case 'PUT':
          targetRouter.put(routePath, handler);
          break;
        case 'PATCH':
          targetRouter.patch(routePath, handler);
          break;
        case 'DELETE':
          targetRouter.delete(routePath, handler);
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${endpoint.method}`);
      }
    }

    console.log(this.routePaths);

    return targetRouter;
  }

  /**
   * Get all registered routes
   */
  getRoutes(): string[] {
    return this.routePaths;
  }

  /**
   * Create step execution handler
   */
  private createStepHandler(pluginName: string, stepName: string) {
    return async (request: IRequest) => {
      try {
        const httpReq = this.extractRequest(request);

        // Populate params from router
        httpReq.params = request.params || {};

        // Parse body for POST/PUT/PATCH requests
        if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
          try {
            httpReq.body = await request.json();
          } catch {
            httpReq.body = {};
          }
        }

        const deviceInfo = await this.generateDeviceInfoInternal(request);

        const result = await this.adapter.executeAuthStep(
          httpReq as any,
          deviceInfo,
        );

        // Handle cookies
        const headers: Record<string, string> = {};
        const cookies: string[] = [];

        // Set cookies from secret field (OAuth flow)
        if (result.secret && typeof result.secret === 'object') {
          for (const [key, value] of Object.entries(result.secret)) {
            cookies.push(
              this.createCookieHeader(key, value, {
                httpOnly: true,
                secure: true,
                path: '/',
                sameSite: 'Lax',
                maxAge: 600, // 10 minutes for OAuth state/verifier
              }),
            );
          }
        }

        // Set session cookies if configured
        if (this.config.cookie && result.data?.token) {
          const cookie = this.config.cookie;
          const options = cookie.options;
          const token = result.data.token;

          if (typeof token === 'string') {
            cookies.push(this.createCookieHeader(cookie.name, token, options));
          } else {
            cookies.push(
              this.createCookieHeader(cookie.name, token.accessToken, options),
            );

            if (cookie.refreshOptions && token.refreshToken) {
              const refreshOptions = cookie.refreshOptions;
              cookies.push(
                this.createCookieHeader(
                  cookie.refreshTokenName || 'refreshToken',
                  token.refreshToken,
                  refreshOptions,
                ),
              );
            }
          }
        }

        // Add all cookies to headers
        if (cookies.length > 0) {
          headers['Set-Cookie'] = cookies.join(', ');
        }

        // Handle redirect responses (OAuth flow)
        if (result.redirect) {
          return new Response(null, {
            status: result.status,
            headers: {
              ...headers,
              Location: result.redirect,
            },
          });
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
    return async (request: IRequest) => {
      try {
        const httpReq = this.extractRequest(request);
        const deviceInfo = await this.generateDeviceInfoInternal(request);
        const result = await this.adapter.checkSession(
          httpReq as any,
          deviceInfo,
        );
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
    return async (request: IRequest) => {
      try {
        const params = request.params || {};
        const plugin = params.plugin;
        if (!plugin) {
          throw new Error('Plugin name is required');
        }
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
  private createCookieHeader(
    name: string,
    value: string,
    options: any,
  ): string {
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
export function reAuthRouter(
  config: HttpAdapterConfig,
  generateDeviceInfo?: (request: IRequest) => Promise<Record<string, any>>,
): IttyRouterAdapter {
  const adapter = new IttyRouterAdapter(config, generateDeviceInfo);
  return adapter;
}

export const createReAuthRouter = (
  routerConfig: {
    basePath: string;
    exposeIntrospection: boolean;
    corsOptions?: CorsOptions;
  },
  config: HttpAdapterConfig,
  generateDeviceInfo?: (request: IRequest) => Promise<Record<string, any>>,
): { router: AutoRouterType; adapter: IttyRouterAdapter } => {
  const adapter = new IttyRouterAdapter(config, generateDeviceInfo);
  const router = adapter.createRouter(
    routerConfig.basePath,
    routerConfig.exposeIntrospection,
    routerConfig.corsOptions,
  );
  return { router, adapter };
};
