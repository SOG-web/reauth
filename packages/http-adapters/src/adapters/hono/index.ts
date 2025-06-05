import { Hono, Context } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';
import {
  ReAuthEngine,
  AuthOutput,
  AuthInput,
  Entity,
  AuthToken,
} from '@re-auth/reauth';

// Enhanced Hono Adapter with Clean DX
export class HonoAuthAdapter {
  private app: Hono;
  private engine: ReAuthEngine;
  private config: HonoAuthConfig;

  constructor(engine: ReAuthEngine, config: HonoAuthConfig = {}) {
    this.engine = engine;
    this.config = {
      basePath: '/auth',
      cookieName: 'auth_token',
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      },
      ...config,
    };

    this.app = new Hono();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // Auth middleware - extract and verify token
    this.app.use('*', async (c, next) => {
      const token = this.extractToken(c);

      if (token) {
        try {
          const session = await this.engine.checkSession(token);
          if (session.valid && session.entity) {
            c.set('entity', session.entity);
            c.set('token', session.token);
            c.set('authenticated', true);
          }
        } catch (error) {
          // Invalid token, continue without auth
          console.warn('Invalid token:', error);
        }
      }

      await next();
    });
  }

  private setupRoutes() {
    const routes = this.generateRoutes();

    routes.forEach((route) => {
      this.app.on(
        [route.method],
        route.path,
        ...route.middlewares,
        route.handler,
      );
    });
  }

  private generateRoutes() {
    const routes: RouteDefinition[] = [];

    this.engine.getAllPlugins().forEach((plugin) => {
      plugin.steps.forEach((step) => {
        if (!step.protocol?.http) return;

        const route: RouteDefinition = {
          method: step.protocol.http.method.toUpperCase() as any,
          path: `${this.config.basePath}/${plugin.name}/${step.name}`,
          middlewares: [],
          handler: this.createStepHandler(
            plugin.name,
            step.name,
            step.protocol.http,
          ),
        };

        // Add auth middleware if required
        if (step.protocol.http.auth) {
          route.middlewares.push(this.requireAuth());
        }

        routes.push(route);
      });
    });

    return routes;
  }

  private createStepHandler(
    pluginName: string,
    stepName: string,
    httpConfig: any,
  ) {
    return async (c: Context) => {
      try {
        // Extract inputs from request
        const inputs = await this.extractInputs(c, pluginName, stepName);

        // Add auth context if authenticated
        if (c.get('authenticated')) {
          inputs.entity = c.get('entity') as Entity;
          inputs.token = c.get('token') as AuthToken;
        }

        // Execute the step
        const result = await this.engine.executeStep(
          pluginName,
          stepName,
          inputs,
        );

        // Handle the response
        return this.handleStepResponse(c, result, httpConfig);
      } catch (error: any) {
        console.error(`Error in ${pluginName}.${stepName}:`, error);
        return this.errorResponse(c, error);
      }
    };
  }

  private async extractInputs(
    c: Context,
    pluginName: string,
    stepName: string,
  ): Promise<AuthInput> {
    const expectedInputs = this.engine.getStepInputs(pluginName, stepName);
    const inputs: Record<string, any> = {};

    // Get request body
    const contentType = c.req.header('content-type');
    let body: any = {};

    try {
      if (contentType?.includes('application/json')) {
        body = await c.req.json();
      } else if (contentType?.includes('application/x-www-form-urlencoded')) {
        body = await c.req.parseBody();
      }
    } catch (error) {
      // Ignore parsing errors, continue with empty body
    }

    // Extract expected inputs from various sources
    expectedInputs.forEach((inputName) => {
      // Priority: body > query > params
      inputs[inputName] =
        body[inputName] ?? c.req.query(inputName) ?? c.req.param(inputName);
    });

    // Validate required inputs
    const missingInputs = expectedInputs.filter(
      (input) =>
        inputs[input] === undefined ||
        inputs[input] === null ||
        inputs[input] === '',
    );

    if (missingInputs.length > 0) {
      throw new InputValidationError(
        `Missing required inputs: ${missingInputs.join(', ')}`,
      );
    }

    return inputs;
  }

  private handleStepResponse(
    c: Context,
    result: AuthOutput,
    httpConfig: any,
  ): Response {
    const { token, redirect, success, status, ...data } = result;

    // Handle token (set cookie)
    if (token) {
      setCookie(c, this.config.cookieName!, token, this.config.cookieOptions);
    }

    //TODO: this stills need digging, Might not be correct or be a bug
    // Handle logout (clear cookie)
    if (status === 'logged_out' || (success && !token && c.get('token'))) {
      setCookie(c, this.config.cookieName!, '', {
        ...this.config.cookieOptions,
        maxAge: 0,
      });
    }

    // Handle redirect
    if (redirect) {
      return c.redirect(redirect);
    }

    // Determine status code
    const statusCode = this.getStatusCode(result, httpConfig) as any;

    // Return JSON response
    return c.json(
      {
        success,
        ...data,
      },
      statusCode,
    );
  }

  private getStatusCode(result: AuthOutput, httpConfig: any): number {
    // Check if step defines custom status codes
    if (httpConfig && httpConfig[result.status]) {
      return httpConfig[result.status];
    }

    // Default status codes
    if (!result.success) {
      return result.status === 'unauthorized' ? 401 : 400;
    }

    return result.status === 'created' ? 201 : 200;
  }

  private extractToken(c: Context): string | null {
    // Priority: Authorization header > Cookie > Query param
    return (
      c.req.header('authorization')?.replace(/^Bearer\s+/, '') ||
      getCookie(c, this.config.cookieName!) ||
      // c.req.query('token') ||
      null
    );
  }

  private requireAuth() {
    return async (c: Context, next: any) => {
      if (!c.get('authenticated')) {
        return c.json(
          {
            success: false,
            message: 'Authentication required',
            status: 'unauthorized',
          },
          401,
        );
      }
      await next();
    };
  }

  private errorResponse(c: Context, error: any): Response {
    if (error instanceof InputValidationError) {
      return c.json(
        {
          success: false,
          message: error.message,
          status: 'validation_error',
        },
        400,
      );
    }

    return c.json(
      {
        success: false,
        message: 'Internal server error',
        status: 'error',
      },
      500,
    );
  }

  // Public API
  getHonoApp(): Hono {
    return this.app;
  }

  // Middleware for protecting routes outside auth system
  protect(options: ProtectOptions = {}) {
    return async (c: Context, next: any) => {
      const entity = c.get('entity');

      if (!entity) {
        return c.json(
          {
            success: false,
            message: 'Authentication required',
            status: 'unauthorized',
          },
          401,
        );
      }

      // Role-based access control
      if (options.roles && !options.roles.includes(entity.role)) {
        return c.json(
          {
            success: false,
            message: 'Insufficient permissions',
            status: 'forbidden',
          },
          403,
        );
      }

      // Custom authorization function
      if (options.authorize && !(await options.authorize(entity, c))) {
        return c.json(
          {
            success: false,
            message: 'Access denied',
            status: 'forbidden',
          },
          403,
        );
      }

      await next();
    };
  }

  // Helper to get current user in routes
  getCurrentUser(c: Context) {
    return c.get('entity') || null;
  }

  // Method to add custom routes
  addRoute(
    method: string,
    path: string,
    handler: (c: Context) => Promise<Response> | Response,
  ) {
    this.app.on([method.toUpperCase() as any], path, handler);
    return this;
  }
}

// Configuration interface
export interface HonoAuthConfig {
  basePath?: string;
  cookieName?: string;
  cookieOptions?: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    maxAge?: number;
    domain?: string;
    path?: string;
  };
}

// Route definition interface
interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  middlewares: any[];
  handler: (c: Context) => Promise<Response>;
}

// Protection options
interface ProtectOptions {
  roles?: string[];
  authorize?: (entity: Entity, context: Context) => Promise<boolean> | boolean;
}

// Custom error class
class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputValidationError';
  }
}

export function createHonoAuth(engine: ReAuthEngine, config?: HonoAuthConfig) {
  return new HonoAuthAdapter(engine, config);
}

declare module 'hono' {
  interface ContextVariableMap {
    entity: Entity | null;
    token: AuthToken | null;
    authenticated: boolean;
  }
}

export * from './hono-adapter-v2';