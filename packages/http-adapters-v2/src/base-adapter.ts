import type { AuthInput, AuthOutput } from '../../reauth/src/v2/types.v2';
import type { ReAuthEngineV2 } from '../../reauth/src/v2/engine.v2';
import type {
  HttpAdapterV2Config,
  HttpRequest,
  HttpResponse,
  FrameworkAdapterV2,
  RouteHandler,
  AuthStepRequest,
  SessionRequest,
  PluginEndpoint,
  ApiResponse,
  AuthStepResponse,
  SessionResponse,
  PluginListResponse,
} from './types.js';
import {
  HttpAdapterError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
} from './types.js';

export class ReAuthHttpAdapterV2 {
  private engine: ReAuthEngineV2;
  private config: HttpAdapterV2Config;
  private endpoints: Map<string, PluginEndpoint> = new Map();

  constructor(config: HttpAdapterV2Config) {
    this.engine = config.engine;
    this.config = config;
    this.buildEndpoints();
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
          path: `${this.config.basePath || ''}/auth/${plugin.name}/${step.name}`,
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
  getEndpoint(pluginName: string, stepName: string): PluginEndpoint | undefined {
    return this.endpoints.get(`${pluginName}:${stepName}`);
  }

  /**
   * Execute authentication step
   */
  async executeAuthStep(req: AuthStepRequest): Promise<AuthStepResponse> {
    const { plugin: pluginName, step: stepName } = req.params;
    
    const endpoint = this.getEndpoint(pluginName, stepName);
    if (!endpoint) {
      throw new NotFoundError(`Endpoint not found: ${pluginName}/${stepName}`);
    }

    // Check authentication if required
    if (endpoint.requiresAuth) {
      await this.validateAuthentication(req);
    }

    // Extract input from request
    const input = this.extractStepInput(req, endpoint);

    try {
      // Execute the step
      const output = await this.engine.executeStep(pluginName, stepName, input);
      
      return {
        success: true,
        data: {
          ...output,
          sessionToken: output.token || undefined,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      throw new HttpAdapterError(
        `Step execution failed: ${error instanceof Error ? error.message : String(error)}`,
        500,
        'STEP_EXECUTION_ERROR',
        { pluginName, stepName, error }
      );
    }
  }

  /**
   * Create a new session
   */
  async createSession(req: SessionRequest): Promise<SessionResponse> {
    const { subjectType, subjectId, ttlSeconds } = req.body || {};
    
    if (!subjectType || !subjectId) {
      throw new ValidationError('subjectType and subjectId are required');
    }

    try {
      const token = await this.engine.createSessionFor(subjectType, subjectId, ttlSeconds);
      
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
        'SESSION_CREATION_ERROR'
      );
    }
  }

  /**
   * Check session validity
   */
  async checkSession(req: SessionRequest): Promise<SessionResponse> {
    const token = this.extractSessionToken(req);
    
    if (!token) {
      return {
        success: true,
        data: {
          valid: false,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
    }

    try {
      const result = await this.engine.checkSession(token);
      
      return {
        success: true,
        data: {
          valid: result.valid,
          subject: result.subject,
          token: result.token || undefined,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: true,
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
        'SESSION_DESTRUCTION_ERROR'
      );
    }
  }

  /**
   * List all available plugins
   */
  async listPlugins(): Promise<PluginListResponse> {
    const plugins = this.engine.getAllPlugins();
    
    const data = plugins.map(plugin => ({
      name: plugin.name,
      description: `${plugin.name} authentication plugin`,
      steps: (plugin.steps || []).map(step => ({
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
      steps: (plugin.steps || []).map(step => ({
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
    
    return {
      success: true,
      data: introspectionData,
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
  private extractSessionToken(req: HttpRequest): string | null {
    // Try Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try cookie
    if (req.cookies?.['reauth-session']) {
      return req.cookies['reauth-session'];
    }

    // Try body token
    if (req.body?.token) {
      return req.body.token;
    }

    return null;
  }

  /**
   * Extract step input from request
   */
  private extractStepInput(req: HttpRequest, endpoint: PluginEndpoint): AuthInput {
    const input: AuthInput = {
      ...req.body,
      ...req.query,
    };

    // Add session token if available
    const token = this.extractSessionToken(req);
    if (token) {
      input.token = token;
    }

    // Add request metadata
    if (req.ip) {
      input.ip = req.ip;
    }
    if (req.userAgent) {
      input.userAgent = req.userAgent;
    }

    return input;
  }

  /**
   * Validate authentication for protected endpoints
   */
  private async validateAuthentication(req: HttpRequest): Promise<void> {
    const token = this.extractSessionToken(req);
    
    if (!token) {
      throw new AuthenticationError('Authentication required');
    }

    const session = await this.engine.checkSession(token);
    if (!session.valid) {
      throw new AuthenticationError('Invalid or expired session');
    }
  }

  /**
   * Create framework-specific adapter
   */
  createAdapter<TRequest = any, TResponse = any, TNext = any>(
    adapter: FrameworkAdapterV2<TRequest, TResponse, TNext>
  ): FrameworkAdapterV2<TRequest, TResponse, TNext> {
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