import { AuthInput, ReAuthEngine, Token } from '@re-auth/reauth';
import type { LoggerInterface } from '@re-auth/logger';
import type {
  HttpAdapterConfig,
  HttpRequest,
  HttpResponse,
  FrameworkAdapter,
  RouteHandler,
  AuthStepRequest,
  SessionRequest,
  PluginEndpoint,
  ApiResponse,
  AuthStepResponse,
  SessionResponse,
  PluginListResponse,
  AuthenticatedUser,
} from './types';
import {
  HttpAdapterError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
} from './types';

export class ReAuthHttpAdapter {
  private engine: ReAuthEngine;
  protected config: HttpAdapterConfig;
  private endpoints: Map<string, PluginEndpoint> = new Map();
  private logger: LoggerInterface;

  constructor(config: HttpAdapterConfig, logger: LoggerInterface) {
    this.engine = config.engine;
    this.config = config;
    this.logger = logger;
    this.buildEndpoints();
  }

  /**
   * Get adapter configuration
   */
  getConfig(): HttpAdapterConfig {
    return this.config;
  }

  /**
   * Build endpoint map from registered plugins
   */
  private buildEndpoints(): void {
    const plugins = this.engine.getAllPlugins();

    for (const plugin of plugins) {
      if (!plugin.steps) continue;

      for (const step of plugin.steps) {
        const endpoint: PluginEndpoint = {
          pluginName: plugin.name,
          stepName: step.name,
          path: `${this.config.basePath || ''}/${plugin.name}/${step.name}`,
          method: step.protocol?.http?.method || 'POST',
          requiresAuth: Boolean(step.protocol?.http?.auth),
          description: step.description,
          inputSchema: step.validationSchema,
          outputSchema: step.outputs,
        };

        const key = `${plugin.name}:${step.name}`;
        this.endpoints.set(key, endpoint);
      }
    }
  }

  /**
   * Get all available endpoints
   */
  getEndpoints(): PluginEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Get endpoint by plugin and step name
   */
  getEndpoint(
    pluginName: string,
    stepName: string,
  ): PluginEndpoint | undefined {
    return this.endpoints.get(`${pluginName}:${stepName}`);
  }

  /**
   * Execute authentication step
   */
  async executeAuthStep(
    req: AuthStepRequest,
    deviceInfo: Record<string, any>,
  ): Promise<AuthStepResponse> {
    const endpoint = this.getEndpoint(req.plugin.name, req.plugin.step);
    if (!endpoint) {
      throw new NotFoundError(
        `Endpoint not found: ${req.plugin.name}/${req.plugin.step}`,
      );
    }

    // Check authentication if required
    if (endpoint.requiresAuth) {
      await this.requireAuthentication(req, deviceInfo);
    } else {
      //NOTE: this is to ensure token will be auto refresh if needed when a token is availabe
      await this.getCurrentUser(req, deviceInfo);
    }

    // Extract input from request
    const input = this.extractStepInput(req, endpoint, deviceInfo);

    try {
      // Execute the step
      const output = await this.engine.executeStep(
        endpoint.pluginName,
        endpoint.stepName,
        input,
      );

      // Return standardized response
      const pl = this.engine.getPlugin(endpoint.pluginName);
      const step = pl?.steps?.find((s) => s.name === endpoint.stepName);

      const status = step?.protocol?.http?.codes?.[output.status] || 200;

      return {
        success: true,
        data: {
          ...output,
          sessionToken: output.token,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
        status,
        redirect: output.redirect, // Include redirect URL for OAuth flow
        secret: output.secret, // Include cookies to set for OAuth flow
      };
    } catch (error) {
      throw new HttpAdapterError(
        `Step execution failed: ${error instanceof Error ? error.message : String(error)}`,
        500,
        'STEP_EXECUTION_ERROR',
        { pluginName: endpoint.pluginName, stepName: endpoint.stepName, error },
      );
    }
  }

  /**
   * Create a new session
   */
  async createSession(
    req: SessionRequest,
    deviceInfo: Record<string, any>,
  ): Promise<SessionResponse> {
    const { subjectType, subjectId, ttlSeconds } = req.body || {};

    if (!subjectType || !subjectId) {
      throw new ValidationError('subjectType and subjectId are required');
    }

    try {
      const token = await this.engine.createSessionFor(
        subjectType,
        subjectId,
        ttlSeconds,
        deviceInfo,
      );

      return {
        success: true,
        data: {
          valid: true,
          token,
          expiresAt: ttlSeconds
            ? new Date(Date.now() + ttlSeconds * 1000).toISOString()
            : undefined,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      throw new HttpAdapterError(
        `Session creation failed: ${error instanceof Error ? error.message : String(error)}`,
        500,
        'SESSION_CREATION_ERROR',
      );
    }
  }

  /**
   * Check session validity
   */
  async checkSession(
    req: SessionRequest,
    deviceInfo: Record<string, any>,
  ): Promise<SessionResponse> {
    const token = this.extractSessionToken(req);

    if (!token) {
      return {
        success: false,
        data: {
          valid: false,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
    }

    try {
      const result = await this.engine.checkSession(token, deviceInfo);

      if (!result.subject) {
        return {
          success: false,
          data: {
            valid: false,
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        };
      }

      return {
        success: true,
        data: {
          valid: result.valid,
          subject: result.subject,
          token: result.token,
          metadata: {
            payload: result.payload,
            type: result.type,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        data: {
          valid: false,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Destroy current session
   */
  async destroySession(req: SessionRequest): Promise<ApiResponse> {
    const token = this.extractSessionToken(req);

    if (!token) {
      throw new ValidationError('No session token provided');
    }

    try {
      await this.engine.getSessionService().destroySession(token);

      return {
        success: true,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      throw new HttpAdapterError(
        `Session destruction failed: ${error instanceof Error ? error.message : String(error)}`,
        500,
        'SESSION_DESTRUCTION_ERROR',
      );
    }
  }

  /**
   * List all available plugins
   */
  async listPlugins(): Promise<PluginListResponse> {
    const plugins = this.engine.getAllPlugins();

    const data = plugins.map((plugin) => ({
      name: plugin.name,
      description: `${plugin.name} authentication plugin`,
      steps: (plugin.steps || []).map((step) => ({
        name: step.name,
        description: step.description,
        method: step.protocol?.http?.method || 'POST',
        path: `${this.config.basePath || ''}/auth/${plugin.name}/${step.name}`,
        requiresAuth: Boolean(step.protocol?.http?.auth),
      })),
    }));

    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Get specific plugin details
   */
  async getPlugin(pluginName: string): Promise<ApiResponse> {
    const plugin = this.engine.getPlugin(pluginName);

    if (!plugin) {
      throw new NotFoundError(`Plugin not found: ${pluginName}`);
    }

    const data = {
      name: plugin.name,
      description: `${plugin.name} authentication plugin`,
      steps: (plugin.steps || []).map((step) => ({
        name: step.name,
        description: step.description,
        method: step.protocol?.http?.method || 'POST',
        path: `${this.config.basePath || ''}/auth/${plugin.name}/${step.name}`,
        requiresAuth: Boolean(step.protocol?.http?.auth),
        inputs: step.inputs || [],
        inputSchema: step.validationSchema?.toJsonSchema?.() || {},
        outputSchema: step.outputs?.toJsonSchema?.() || {},
      })),
    };

    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Get full introspection data
   */
  async getIntrospection(): Promise<ApiResponse> {
    const introspectionData = this.engine.getIntrospectionData();

    // Add HTTP adapter configuration to introspection
    const httpConfig = {
      basePath: this.config.basePath || '',
      tokenConfig: {
        header: {
          accessTokenHeader:
            this.config.headerToken?.accesssTokenHeader || 'authorization',
          refreshTokenHeader:
            this.config.headerToken?.refreshTokenHeader || 'x-refresh-token',
          useBearer: true, // Default to Bearer token in Authorization header
        },
        cookie: {
          accessTokenName: this.config.cookie?.name || 'reauth-session',
          refreshTokenName:
            this.config.cookie?.refreshTokenName || 'reauth-refresh',
          enabled: !!this.config.cookie,
        },
      },
    };

    return {
      success: true,
      data: {
        ...introspectionData,
        httpConfig,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<ApiResponse> {
    return {
      success: true,
      data: {
        status: 'healthy',
        version: '2.0.0',
        plugins: this.engine.getAllPlugins().length,
        endpoints: this.endpoints.size,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Extract session token from request
   */
  private extractSessionToken(req: HttpRequest): Token {
    let accessToken: string | null = null;
    let refreshToken: string | null = null;

    // Try Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
    }

    // check custom headers
    if (
      !accessToken &&
      req.headers[
        this.config.headerToken?.accesssTokenHeader || 'x-access-token'
      ]
    ) {
      accessToken =
        req.headers[
          this.config.headerToken?.accesssTokenHeader || 'x-access-token'
        ]!;
    }
    if (
      !refreshToken &&
      req.headers[
        this.config.headerToken?.refreshTokenHeader || 'x-refresh-token'
      ]
    ) {
      refreshToken =
        req.headers[
          this.config.headerToken?.refreshTokenHeader || 'x-refresh-token'
        ]!;
    }

    // Try cookie
    if (
      !accessToken &&
      req.cookies?.[this.config.cookie?.name || 'reauth-session']
    ) {
      accessToken = req.cookies[this.config.cookie?.name || 'reauth-session']!;
    }

    if (
      !refreshToken &&
      req.cookies?.[this.config.cookie?.refreshTokenName || 'reauth-refresh']
    ) {
      refreshToken =
        req.cookies[this.config.cookie?.refreshTokenName || 'reauth-refresh']!;
    }

    if (!accessToken) {
      this.logger.info('http', 'No access token found in request', {
        path: req.path,
        hasHeaders: !!req.headers,
      });
      return null;
    }

    if (accessToken && refreshToken) {
      this.logger.info('http', 'Access token and refresh token found', {
        path: req.path,
        hasHeaders: !!req.headers,
      });
      return { accessToken, refreshToken };
    }

    if (accessToken && !refreshToken) {
      this.logger.info('http', 'Access token found without refresh token', {
        path: req.path,
        hasHeaders: !!req.headers,
      });
      return accessToken;
    }

    this.logger.info('http', 'No access token or refresh token found', {
      path: req.path,
      hasHeaders: !!req.headers,
    });
    return null;
  }

  /**
   * Extract step input from request
   */
  private extractStepInput(
    req: HttpRequest,
    endpoint: PluginEndpoint,
    deviceInfo: Record<string, any>,
  ): AuthInput {
    const input: AuthInput = {
      ...req.body,
      ...req.query,
      ...req.params,
      ...req.cookies, // Add cookies so OAuth flow can read oauth_state, etc.
    };

    // Add session token if available
    const token = this.extractSessionToken(req);
    if (token) {
      input.token = token;
    }

    // Add device info if provided
    if (deviceInfo) {
      input.deviceInfo = deviceInfo;
    }

    // Add request metadata for backward compatibility
    if (req.ip) {
      input.ip = req.ip;
    }
    if (req.userAgent) {
      input.userAgent = req.userAgent;
    }

    return input;
  }

  /**
   * Get current authenticated user from request
   */
  async getCurrentUser(
    req: HttpRequest,
    deviceInfo: Record<string, any>,
  ): Promise<AuthenticatedUser | null> {
    const token = this.extractSessionToken(req);

    if (!token) {
      this.logger.info('http', 'No token found in getCurrentUser', {
        path: req.path,
        hasHeaders: !!req.headers,
      });
      return null;
    }

    try {
      const session = await this.engine.checkSession(token, deviceInfo);

      if (!session.valid || !session.subject) {
        this.logger.warn('http', 'Session is not valid or subject not found', {
          hasHeaders: !!req.headers,
        });
        return null;
      }

      return {
        subject: session.subject,
        token: session.token || token,
        valid: session.valid,
        metadata: {
          payload: session.payload,
          type: session.type,
        },
      };
    } catch (error) {
      // Silently return null if session check fails
      this.logger.error('http', 'Session check failed', {
        hasHeaders: !!req.headers,
        error,
      });
      return null;
    }
  }

  /**
   * Authenticate request and return user or throw error
   */
  async requireAuthentication(
    req: HttpRequest,
    deviceInfo: Record<string, any>,
  ): Promise<AuthenticatedUser> {
    const user = await this.getCurrentUser(req, deviceInfo);

    if (!user) {
      this.logger.warn('http', 'Authentication required but no user found', {
        path: req.path,
        hasHeaders: !!req.headers,
      });
      throw new AuthenticationError('Authentication required');
    }

    return user;
  }

  /**
   * Create framework-specific adapter
   */
  createAdapter<TRequest = any, TResponse = any, TNext = any>(
    adapter: FrameworkAdapter<TRequest, TResponse, TNext>,
  ): FrameworkAdapter<TRequest, TResponse, TNext> {
    return adapter;
  }

  /**
   * Generic route handler factory
   */
  createRouteHandler(handler: RouteHandler) {
    return async (req: HttpRequest, res: HttpResponse): Promise<void> => {
      try {
        const result = await handler(req, res);
        if (result) {
          res.status(200).json(result);
        }
      } catch (error) {
        this.handleError(error, res);
      }
    };
  }

  /**
   * Error handler
   */
  private handleError(error: unknown, res: HttpResponse): void {
    if (error instanceof HttpAdapterError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
}
