import type { Request, Response, NextFunction, Router } from 'express';
import type {
  HttpAdapterV2Config,
  FrameworkAdapterV2,
  HttpRequest,
  HttpResponse,
  MiddlewareFunction,
  AuthenticatedUser,
} from '../types.js';
import { ReAuthHttpAdapterV2 } from '../base-adapter.js';

export class ExpressAdapterV2 implements FrameworkAdapterV2<Request, Response, NextFunction> {
  public readonly name = 'express';
  private adapter: ReAuthHttpAdapterV2;

  constructor(config: HttpAdapterV2Config) {
    this.adapter = new ReAuthHttpAdapterV2(config);
  }

  /**
   * Create Express middleware that populates req.user
   */
  createUserMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
  createMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
  createRouter(): Router {
    const express = require('express');
    const router = express.Router();

    // Add middleware
    router.use(this.createMiddleware());

    // Optionally add user middleware if configured
    // Users can add this separately: router.use(adapter.createUserMiddleware());

    // Authentication step routes
    router.post('/auth/:plugin/:step', this.createStepHandler());
    router.get('/auth/:plugin/:step', this.createStepHandler());
    router.put('/auth/:plugin/:step', this.createStepHandler());
    router.patch('/auth/:plugin/:step', this.createStepHandler());
    router.delete('/auth/:plugin/:step', this.createStepHandler());

    // Session management routes
    router.get('/session', this.createSessionCheckHandler());
    router.post('/session', this.createSessionCreateHandler());
    router.delete('/session', this.createSessionDestroyHandler());

    // Plugin introspection routes
    router.get('/plugins', this.createPluginListHandler());
    router.get('/plugins/:plugin', this.createPluginDetailsHandler());

    // Introspection and health
    router.get('/introspection', this.createIntrospectionHandler());
    router.get('/health', this.createHealthHandler());

    return router;
  }

  /**
   * Create step execution handler
   */
  private createStepHandler(): (req: Request, res: Response) => Promise<void> {
    return async (req: Request, res: Response): Promise<void> => {
      try {
        const httpReq = this.extractRequest(req);
        const result = await this.adapter.executeAuthStep(httpReq as any);
        this.sendResponse(res, result);
      } catch (error) {
        this.handleError(res, error as Error);
      }
    };
  }

  /**
   * Create session check handler
   */
  private createSessionCheckHandler(): (req: Request, res: Response) => Promise<void> {
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
   * Create session creation handler
   */
  private createSessionCreateHandler(): (req: Request, res: Response) => Promise<void> {
    return async (req: Request, res: Response): Promise<void> => {
      try {
        const httpReq = this.extractRequest(req);
        const result = await this.adapter.createSession(httpReq as any);
        this.sendResponse(res, result, 201);
      } catch (error) {
        this.handleError(res, error as Error);
      }
    };
  }

  /**
   * Create session destruction handler
   */
  private createSessionDestroyHandler(): (req: Request, res: Response) => Promise<void> {
    return async (req: Request, res: Response): Promise<void> => {
      try {
        const httpReq = this.extractRequest(req);
        const result = await this.adapter.destroySession(httpReq as any);
        this.sendResponse(res, result);
      } catch (error) {
        this.handleError(res, error as Error);
      }
    };
  }

  /**
   * Create plugin list handler
   */
  private createPluginListHandler(): (req: Request, res: Response) => Promise<void> {
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
  private createPluginDetailsHandler(): (req: Request, res: Response) => Promise<void> {
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
  private createIntrospectionHandler(): (req: Request, res: Response) => Promise<void> {
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
  private createHealthHandler(): (req: Request, res: Response) => Promise<void> {
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
  getAdapter(): ReAuthHttpAdapterV2 {
    return this.adapter;
  }
}

/**
 * Factory function to create Express adapter
 */
export function createExpressAdapter(config: HttpAdapterV2Config): ExpressAdapterV2 {
  return new ExpressAdapterV2(config);
}

/**
 * Express middleware factory function
 */
export function expressReAuth(config: HttpAdapterV2Config): MiddlewareFunction<Request, Response, NextFunction> {
  const adapter = new ExpressAdapterV2(config);
  return adapter.createMiddleware();
}