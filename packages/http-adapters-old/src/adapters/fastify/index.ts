import {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import fastifyCookie from '@fastify/cookie';
import { ReAuthEngine, AuthOutput, Entity, AuthToken } from '@re-auth/reauth';

export interface FastifyAuthConfig extends FastifyPluginOptions {
  prefix?: string;
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

export class FastifyAuthAdapter {
  private fastify: FastifyInstance;
  private engine: ReAuthEngine;
  private config: Required<FastifyAuthConfig>;

  constructor(
    fastify: FastifyInstance,
    engine: ReAuthEngine,
    config: FastifyAuthConfig = {},
  ) {
    this.fastify = fastify;
    this.engine = engine;
    this.config = {
      prefix: '/auth',
      cookieName: 'auth_token',
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      },
      ...config,
    };

    this.setup();
  }

  private async setup() {
    // Register cookie plugin
    await this.fastify.register(fastifyCookie, {
      secret: process.env.COOKIE_SECRET,
      parseOptions: this.config.cookieOptions,
    });

    // Add decorators
    this.fastify.decorateRequest('user', undefined);
    this.fastify.decorateRequest('token', undefined);
    this.fastify.decorateRequest('isAuthenticated', false);

    // Add auth hook
    this.fastify.addHook('onRequest', this.authHook.bind(this));

    // Register routes
    this.registerRoutes();
  }

  private async authHook(request: FastifyRequest, reply: FastifyReply) {
    const token = this.extractToken(request);

    if (token) {
      try {
        const session = await this.engine.checkSession(token);
        if (session.valid && session.entity) {
          request.user = session.entity;
          request.token = session.token;
          request.isAuthenticated = true;
        }
      } catch (error) {
        request.log.warn('Invalid token:', error);
      }
    }
  }

  private registerRoutes() {
    const plugins = this.engine.getAllPlugins();

    this.fastify.register(
      async (instance) => {
        // Add auth utility methods
        instance.decorate('authenticate', this.authenticate.bind(this));

        // Register plugin routes
        plugins.forEach((plugin) => {
          plugin.steps.forEach((step) => {
            if (!step.protocol?.http) return;

            const path = `/${plugin.name}/${step.name}`;
            const method = step.protocol.http.method.toLowerCase() as
              | 'get'
              | 'post'
              | 'put'
              | 'delete'
              | 'patch';

            // Create route config
            const routeConfig: any = {
              method: step.protocol.http.method,
              url: path,
              handler: this.createStepHandler(
                plugin.name,
                step.name,
                step.protocol.http,
              ),
            };

            // Add auth preValidation if required
            if (step.protocol.http.auth) {
              routeConfig.preValidation = [this.authenticate];
            }

            // Register route
            instance.route(routeConfig);
          });
        });
      },
      { prefix: this.config.prefix },
    );
  }

  private createStepHandler(
    pluginName: string,
    stepName: string,
    httpConfig: any,
  ) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Extract inputs from request
        const inputs = await this.extractInputs(request, pluginName, stepName);

        // Add auth context if authenticated
        if (request.isAuthenticated) {
          inputs.entity = request.user;
          inputs.token = request.token;
        }

        // Execute the step
        const result = await this.engine.executeStep(
          pluginName,
          stepName,
          inputs,
        );

        // Handle the response
        return this.handleStepResponse(request, reply, result, httpConfig);
      } catch (error: any) {
        request.log.error(`Error in ${pluginName}.${stepName}:`, error);
        return this.errorResponse(reply, error);
      }
    };
  }

  private async extractInputs(
    request: FastifyRequest,
    pluginName: string,
    stepName: string,
  ) {
    const expectedInputs = this.engine.getStepInputs(pluginName, stepName);
    const inputs: Record<string, any> = {};

    // Extract from body, query, and params
    expectedInputs.forEach((inputName) => {
      if (
        request.body &&
        typeof request.body === 'object' &&
        inputName in request.body
      ) {
        inputs[inputName] = (request.body as any)[inputName];
      } else if (
        request.query &&
        typeof request.query === 'object' &&
        inputName in request.query
      ) {
        inputs[inputName] = (request.query as any)[inputName];
      } else if (
        request.params &&
        typeof request.params === 'object' &&
        inputName in request.params
      ) {
        inputs[inputName] = (request.params as any)[inputName];
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
    request: FastifyRequest,
    reply: FastifyReply,
    result: AuthOutput,
    httpConfig: any,
  ) {
    const { token, redirect, success, status, ...data } = result;

    // Handle token (set cookie)
    if (token) {
      reply.setCookie(this.config.cookieName, token, this.config.cookieOptions);
    }

    //TODO: this stills need digging, Might not be correct or be a bug
    // Handle logout (clear cookie)
    if (status === 'logged_out' || (success && !token && request.token)) {
      reply.clearCookie(this.config.cookieName, this.config.cookieOptions);
    }

    // Handle redirect
    if (redirect) {
      return reply.redirect(redirect);
    }

    // Determine status code
    const statusCode = this.getStatusCode(result, httpConfig);

    // Return JSON response
    return reply.code(statusCode).send({
      success,
      ...data,
    });
  }

  private getStatusCode(result: AuthOutput, httpConfig: any): number {
    // Check if step defines custom status codes
    if (httpConfig?.[result.status as string]) {
      return httpConfig[result.status as string];
    }

    // Default status codes
    if (!result.success) {
      return result.status === 'unauthorized' ? 401 : 400;
    }

    return result.status === 'created' ? 201 : 200;
  }

  private errorResponse(reply: FastifyReply, error: Error) {
    if (error.name === 'InputValidationError') {
      return reply.code(400).send({
        success: false,
        error: 'Validation Error',
        message: error.message,
      });
    }

    return reply.code(500).send({
      success: false,
      error: 'Internal Server Error',
      message:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }

  private authenticate(
    request: FastifyRequest,
    reply: FastifyReply,
    done: () => void,
  ) {
    if (!request.isAuthenticated) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }
    done();
  }

  private extractToken(request: FastifyRequest): string | null {
    // 1. Check Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // 2. Check cookies
    if (request.cookies?.[this.config.cookieName]) {
      return request.cookies[this.config.cookieName] || null;
    }

    // // 3. Check query parameter
    // if (request.query?.token && typeof request.query.token === 'string') {
    //   return request.query.token;
    // }

    return null;
  }

  protect(options: ProtectOptions) {
    return async (
      request: FastifyRequest,
      reply: FastifyReply,
      done: () => void,
    ) => {
      if (!request.isAuthenticated) {
        return reply.code(401).send({ success: false, error: 'Unauthorized' });
      }

      if (options.roles && !options.roles.includes(request.user!.role)) {
        return reply.code(403).send({ success: false, error: 'Forbidden' });
      }

      if (options.authorize) {
        const authorized = await options.authorize(
          request.user!,
          request,
          reply,
          done,
        );
        if (!authorized) {
          return reply.code(403).send({ success: false, error: 'Forbidden' });
        }
      }

      done();
    };
  }
}

interface ProtectOptions {
  roles?: string[];
  authorize?: (
    user: Entity,
    request: FastifyRequest,
    reply: FastifyReply,
    done: () => void,
  ) => Promise<boolean>;
}

export async function createFastifyAdapter(
  fastify: FastifyInstance,
  engine: ReAuthEngine,
  config?: FastifyAuthConfig,
) {
  return new FastifyAuthAdapter(fastify, engine, config);
}

// Extend Fastify types
declare module 'fastify' {
  interface FastifyRequest {
    user?: Entity;
    token?: AuthToken;
    isAuthenticated: boolean;
  }

  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
      done: () => void,
    ) => void;
  }
}

export default createFastifyAdapter;

export * from './fastify-adapter-';
