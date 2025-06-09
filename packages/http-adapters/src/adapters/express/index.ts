import { Request, Response, NextFunction, Router } from 'express';
import { ReAuthEngine, AuthOutput, Entity, AuthToken } from '@re-auth/reauth';

export interface ExpressAuthConfig {
  path?: string;
  cookieName?: string;
  cookieOptions?: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none' | boolean;
    maxAge?: number;
    domain?: string;
    path?: string;
  };
}

export class ExpressAuthAdapter {
  private router: Router;
  private engine: ReAuthEngine;
  private config: Required<ExpressAuthConfig>;

  constructor(engine: ReAuthEngine, config: ExpressAuthConfig = {}) {
    this.engine = engine;
    this.config = {
      path: '/auth',
      cookieName: 'auth_token',
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days in ms
      },
      ...config,
    };

    this.router = Router();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // Parse cookies
    this.router.use((req, res, next) => {
      if (req.cookies) return next();

      // Simple cookie parsing if no cookie-parser is used
      const cookieHeader = req.headers.cookie || '';
      req.cookies = cookieHeader
        .split(';')
        .reduce((cookies: Record<string, string>, cookie) => {
          const [name, value] = cookie.trim().split('=');
          cookies[name!] = value!;
          return cookies;
        }, {});
      next();
    });

    // Auth middleware
    this.router.use(async (req: any, res, next) => {
      const token = this.extractToken(req);

      if (token) {
        try {
          const session = await this.engine.checkSession(token);
          if (session.valid && session.entity) {
            req.user = session.entity;
            req.token = session.token;
            req.isAuthenticated = () => true;
          }
        } catch (error) {
          console.warn('Invalid token:', error);
        }
      }

      if (!req.isAuthenticated) {
        req.isAuthenticated = () => false;
      }

      next();
    });
  }

  private setupRoutes() {
    const plugins = this.engine.getAllPlugins();

    plugins.forEach((plugin) => {
      plugin.steps.forEach((step) => {
        if (!step.protocol?.http) return;

        const path = `${this.config.path}/${plugin.name}/${step.name}`;
        const method = step.protocol.http.method.toLowerCase() as
          | 'get'
          | 'post'
          | 'put'
          | 'delete'
          | 'patch';

        // Create route handler
        const handler = this.createStepHandler(
          plugin.name,
          step.name,
          step.protocol.http,
        );

        // Add auth middleware if required
        const middlewares = [];
        if (step.protocol.http.auth) {
          middlewares.push(this.requireAuth());
        }

        // Register route
        this.router[method](path, ...middlewares, handler);
      });
    });
  }

  private createStepHandler(
    pluginName: string,
    stepName: string,
    httpConfig: any,
  ) {
    return async (
      req: any,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      try {
        // Extract inputs from request
        const inputs = await this.extractInputs(req, pluginName, stepName);

        // Add auth context if authenticated
        if (req.isAuthenticated()) {
          inputs.entity = req.user;
          inputs.token = req.token;
        }

        // Execute the step
        const result = await this.engine.executeStep(
          pluginName,
          stepName,
          inputs,
        );

        // Handle the response
        return this.handleStepResponse(req, res, result, httpConfig);
      } catch (error: any) {
        console.error(`Error in ${pluginName}.${stepName}:`, error);
        this.errorResponse(res, error);
      }
    };
  }

  private async extractInputs(
    req: Request,
    pluginName: string,
    stepName: string,
  ) {
    const expectedInputs = this.engine.getStepInputs(pluginName, stepName);
    const inputs: Record<string, any> = {};

    // Extract from body, query, and params
    expectedInputs.forEach((inputName) => {
      if (req.body && req.body[inputName] !== undefined) {
        inputs[inputName] = req.body[inputName];
      } else if (req.query[inputName] !== undefined) {
        inputs[inputName] = req.query[inputName];
      } else if ((req.params as any)[inputName] !== undefined) {
        inputs[inputName] = (req.params as any)[inputName];
      }
    });

    // Validate required inputs
    const missingInputs = expectedInputs.filter(
      (input) =>
        inputs[input] === undefined ||
        inputs[input] === null ||
        inputs[input] === '',
    );

    if (missingInputs.length > 0) {
      throw new Error(`Missing required inputs: ${missingInputs.join(', ')}`);
    }

    return inputs;
  }

  private handleStepResponse(
    req: Request,
    res: Response,
    result: AuthOutput,
    httpConfig: any,
  ): void {
    const { token, redirect, success, status, ...data } = result;

    // Handle token (set cookie)
    if (token) {
      res.cookie(this.config.cookieName, token, this.config.cookieOptions);
    }

    //TODO: this stills need digging, Might not be correct or be a bug
    // Handle logout (clear cookie)
    if (status === 'logged_out' || (success && !token && (req as any).token)) {
      res.clearCookie(this.config.cookieName, this.config.cookieOptions);
    }

    // Handle redirect
    if (redirect) {
      res.redirect(redirect);
    }

    // Determine status code
    const statusCode = this.getStatusCode(result, httpConfig);

    // Return JSON response
    res.status(statusCode).json({
      success,
      ...data,
    });
  }

  private getStatusCode(result: AuthOutput, httpConfig: any): number {
    // Check if step defines custom status codes
    if (httpConfig && httpConfig[result.status as string]) {
      return httpConfig[result.status as string];
    }

    // Default status codes
    if (!result.success) {
      return result.status === 'unauthorized' ? 401 : 400;
    }

    return result.status === 'created' ? 201 : 200;
  }

  private errorResponse(res: Response, error: Error) {
    console.error('Auth error:', error);

    if (error.name === 'InputValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }

  private requireAuth() {
    return (req: any, res: Response, next: NextFunction) => {
      if (req.isAuthenticated()) {
        return next();
      }
      res.status(401).json({ success: false, error: 'Unauthorized' });
    };
  }

  private extractToken(req: Request): string | null {
    // 1. Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // 2. Check cookies
    if (req.cookies?.[this.config.cookieName]) {
      return req.cookies[this.config.cookieName];
    }

    // // 3. Check query parameter
    // if (req.query?.token && typeof req.query.token === 'string') {
    //   return req.query.token;
    // }

    return null;
  }

  getRouter() {
    return this.router;
  }

  protect(options: ProtectOptions = {}) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const entity = req.user;

      if (!entity) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      if (options.roles && !options.roles.includes(entity!.role)) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }

      if (options.authorize) {
        const authorized = await options.authorize(entity!, req, res, next);
        if (!authorized) {
          return res.status(403).json({ success: false, error: 'Forbidden' });
        }
      }

      next();
    };
  }
}

// Protection options
interface ProtectOptions {
  roles?: string[];
  authorize?: (
    entity: Entity,
    request: Request,
    response: Response,
    next: NextFunction,
  ) => Promise<boolean> | boolean;
}

export function createExpressAdapter(
  engine: ReAuthEngine,
  config?: ExpressAuthConfig,
) {
  const adapter = new ExpressAuthAdapter(engine, config);
  return adapter.getRouter();
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: Entity;
      token?: AuthToken;
      isAuthenticated(): boolean;
    }
  }
}

export default createExpressAdapter;

export * from './express-adapter-v2';
