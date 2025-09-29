import type { Request, Response, NextFunction, Router } from 'express';
import express from 'express';
import type {
  HttpAdapterConfig,
  FrameworkAdapter,
  HttpRequest,
  MiddlewareFunction,
  AuthenticatedUser,
  AuthStepRequest,
} from '../types';
import { ReAuthHttpAdapter } from '../base-adapter';

export class ExpressAdapter
  implements FrameworkAdapter<Request, Response, NextFunction>
{
  public readonly name = 'express';
  private adapter: ReAuthHttpAdapter;

  constructor(
    config: HttpAdapterConfig,
    private exposeIntrospection: boolean,
  ) {
    this.adapter = new ReAuthHttpAdapter(config);
  }

  /**
   * Create Express middleware that populates req.user
   */
  createUserMiddleware(): (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => Promise<void> {
    return async (
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      try {
        const httpReq = this.extractRequest(req);
        (req as any).user = await this.adapter.getCurrentUser(httpReq);
        next();
      } catch (error) {
        // Don't fail the request if user lookup fails, just continue with req.user = null
        (req as any).user = null;
        next();
      }
    };
  }

  /**
   * Create Express middleware that adds adapter to request
   */
  createMiddleware(): (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => Promise<void> {
    return async (
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      // Add adapter to request for access in route handlers
      (req as any).reauth = this.adapter;
      next();
    };
  }

  /**
   * Extract HTTP request from Express request
   */
  extractRequest(req: Request): HttpRequest {
    return {
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query as Record<string, any>,
      params: req.params,
      body: req.body,
      headers: req.headers as Record<string, string>,
      cookies: req.cookies,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    };
  }

  /**
   * Send response using Express response object
   */
  sendResponse(res: Response, data: any, statusCode: number = 200): void {
    res.status(statusCode).json(data);
  }

  /**
   * Handle error using Express response object
   */
  handleError(res: Response, error: Error, statusCode: number = 500): void {
    res.status(statusCode).json({
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
   * Create Express router with all ReAuth routes
   */
  createRouter(router?: Router, basePath: string = ''): Router {
    // Create a new router if not provided
    router = router || express.Router();

    // Add middleware
    router.use(this.createMiddleware());

    // Session management routes
    router.get(`${basePath}/session`, this.createSessionCheckHandler());

    // Plugin introspection routes

    // Introspection and health
    if (this.exposeIntrospection) {
      router.get(
        `${basePath}/introspection`,
        this.createIntrospectionHandler(),
      );
      router.get(`${basePath}/plugins`, this.createPluginListHandler());
      router.get(
        `${basePath}/plugins/:plugin`,
        this.createPluginDetailsHandler(),
      );
    }

    router.get(`${basePath}/health`, this.createHealthHandler());

    // Authentication step routes
    const endpoints = this.adapter.getEndpoints();
    for (const endpoint of endpoints) {
      if (endpoint.method === 'POST') {
        router.post(endpoint.path, (req: Request, res: Response) =>
          this.createStepHandler({
            name: endpoint.pluginName,
            step: endpoint.stepName,
          }),
        );
      } else if (endpoint.method === 'GET') {
        router.get(
          endpoint.path,
          this.createStepHandler({
            name: endpoint.pluginName,
            step: endpoint.stepName,
          }),
        );
      } else if (endpoint.method === 'PUT') {
        router.put(
          endpoint.path,
          this.createStepHandler({
            name: endpoint.pluginName,
            step: endpoint.stepName,
          }),
        );
      } else if (endpoint.method === 'PATCH') {
        router.patch(
          endpoint.path,
          this.createStepHandler({
            name: endpoint.pluginName,
            step: endpoint.stepName,
          }),
        );
      } else if (endpoint.method === 'DELETE') {
        router.delete(
          endpoint.path,
          this.createStepHandler({
            name: endpoint.pluginName,
            step: endpoint.stepName,
          }),
        );
      }
    }

    return router;
  }

  /**
   * Create step execution handler
   */
  private createStepHandler(plugin: {
    name: string;
    step: string;
  }): (req: Request, res: Response) => Promise<void> {
    return async (req: Request, res: Response): Promise<void> => {
      try {
        const httpReq = this.extractRequest(req);

        const request: AuthStepRequest = {
          ...httpReq,
          plugin: {
            name: plugin.name,
            step: plugin.step,
          },
        };

        const result = await this.adapter.executeAuthStep(request);
        this.sendResponse(res, result, result.status);
      } catch (error) {
        this.handleError(res, error as Error);
      }
    };
  }

  /**
   * Create session check handler
   */
  private createSessionCheckHandler(): (
    req: Request,
    res: Response,
  ) => Promise<void> {
    return async (req: Request, res: Response): Promise<void> => {
      try {
        const httpReq = this.extractRequest(req);
        const result = await this.adapter.checkSession(httpReq as any);
        this.sendResponse(res, result);
      } catch (error) {
        this.handleError(res, error as Error);
      }
    };
  }

  /**
   * Create plugin list handler
   */
  private createPluginListHandler(): (
    req: Request,
    res: Response,
  ) => Promise<void> {
    return async (req: Request, res: Response): Promise<void> => {
      try {
        const result = await this.adapter.listPlugins();
        this.sendResponse(res, result);
      } catch (error) {
        this.handleError(res, error as Error);
      }
    };
  }

  /**
   * Create plugin details handler
   */
  private createPluginDetailsHandler(): (
    req: Request,
    res: Response,
  ) => Promise<void> {
    return async (req: Request, res: Response): Promise<void> => {
      try {
        const { plugin } = req.params;
        if (!plugin) {
          this.handleError(res, new Error('Plugin parameter is required'), 400);
          return;
        }
        const result = await this.adapter.getPlugin(plugin);
        this.sendResponse(res, result);
      } catch (error) {
        this.handleError(res, error as Error);
      }
    };
  }

  /**
   * Create introspection handler
   */
  private createIntrospectionHandler(): (
    req: Request,
    res: Response,
  ) => Promise<void> {
    return async (req: Request, res: Response): Promise<void> => {
      try {
        const result = await this.adapter.getIntrospection();
        this.sendResponse(res, result);
      } catch (error) {
        this.handleError(res, error as Error);
      }
    };
  }

  /**
   * Create health check handler
   */
  private createHealthHandler(): (
    req: Request,
    res: Response,
  ) => Promise<void> {
    return async (req: Request, res: Response): Promise<void> => {
      try {
        const result = await this.adapter.healthCheck();
        this.sendResponse(res, result);
      } catch (error) {
        this.handleError(res, error as Error);
      }
    };
  }

  /**
   * Get current user from Express request
   */
  async getCurrentUser(req: Request): Promise<AuthenticatedUser | null> {
    // If user is already populated by middleware, return it
    if ((req as any).user !== undefined) {
      return (req as any).user;
    }

    // Otherwise, check session
    const httpReq = this.extractRequest(req);
    return await this.adapter.getCurrentUser(httpReq);
  }

  /**
   * Get the base adapter instance
   */
  getAdapter(): ReAuthHttpAdapter {
    return this.adapter;
  }
}

/**
 * Factory function to create Express adapter
 */
export function createExpressAdapter(
  config: HttpAdapterConfig,
  exposeIntrospection: boolean = false,
): ExpressAdapter {
  return new ExpressAdapter(config, exposeIntrospection);
}

/**
 * Express middleware factory function
 */
export function expressReAuth(
  config: HttpAdapterConfig,
  exposeIntrospection: boolean = false,
): MiddlewareFunction<Request, Response, NextFunction> {
  const adapter = new ExpressAdapter(config, exposeIntrospection);
  return adapter.createMiddleware();
}
