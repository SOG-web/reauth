// import type {
//   FastifyInstance,
//   FastifyRequest,
//   FastifyReply,
//   FastifyPluginAsync,
// } from 'fastify';
// import type {
//   HttpAdapterConfig,
//   FrameworkAdapter,
//   HttpRequest,
//   HttpResponse,
//   AuthenticatedUser,
// } from '../types.js';
// import { ReAuthHttpAdapter } from '../base-adapter.js';

// export class FastifyAdapter
//   implements FrameworkAdapter<FastifyRequest, FastifyReply, never>
// {
//   public readonly name = 'fastify';
//   private adapter: ReAuthHttpAdapter;

//   constructor(config: HttpAdapterConfig) {
//     this.adapter = new ReAuthHttpAdapter(config);
//   }

//   /**
//    * Create Fastify middleware (not used directly, but for compatibility)
//    */
//   createMiddleware(): never {
//     throw new Error('Fastify uses plugin system, use createPlugin() instead');
//   }

//   /**
//    * Create user middleware (Fastify hook)
//    */
//   createUserMiddleware(): never {
//     throw new Error(
//       'Fastify uses plugin system with hooks, use createPlugin() with user population instead',
//     );
//   }

//   /**
//    * Get current user from Fastify request
//    */
//   async getCurrentUser(req: FastifyRequest): Promise<AuthenticatedUser | null> {
//     // If user is already populated by hook, return it
//     if ((req as any).user !== undefined) {
//       return (req as any).user;
//     }

//     // Otherwise, check session
//     const httpReq = this.extractRequest(req);
//     return await this.adapter.getCurrentUser(httpReq);
//   }

//   /**
//    * Extract HTTP request from Fastify request
//    */
//   extractRequest(req: FastifyRequest): HttpRequest {
//     return {
//       method: req.method,
//       url: req.url,
//       path: req.url.split('?')[0] || '',
//       query: req.query as Record<string, any>,
//       params: req.params as Record<string, string>,
//       body: req.body,
//       headers: req.headers as Record<string, string>,
//       cookies: (req as any).cookies || {},
//       ip: req.ip,
//       userAgent: req.headers['user-agent'] || '',
//     };
//   }

//   /**
//    * Send response using Fastify reply object
//    */
//   sendResponse(reply: FastifyReply, data: any, statusCode: number = 200): void {
//     reply.status(statusCode).send(data);
//   }

//   /**
//    * Handle error using Fastify reply object
//    */
//   handleError(
//     reply: FastifyReply,
//     error: Error,
//     statusCode: number = 500,
//   ): void {
//     reply.status(statusCode).send({
//       success: false,
//       error: {
//         code: 'ERROR',
//         message: error.message,
//       },
//       meta: {
//         timestamp: new Date().toISOString(),
//       },
//     });
//   }

//   /**
//    * Create Fastify plugin with user population
//    */
//   createUserPlugin(): FastifyPluginAsync {
//     return async (fastify: FastifyInstance): Promise<void> => {
//       // Add preHandler hook to populate user on every request
//       fastify.addHook('preHandler', async (request: FastifyRequest) => {
//         const httpReq = this.extractRequest(request);
//         (request as any).user = await this.adapter.getCurrentUser(httpReq);
//       });
//     };
//   }

//   /**
//    * Create Fastify plugin
//    */
//   createPlugin(): FastifyPluginAsync {
//     return async (fastify: FastifyInstance): Promise<void> => {
//       // Decorate fastify instance with adapter
//       fastify.decorate('reauth', this.adapter);

//       // Authentication step routes
//       fastify.post('/auth/:plugin/:step', this.createStepHandler());
//       fastify.get('/auth/:plugin/:step', this.createStepHandler());
//       fastify.put('/auth/:plugin/:step', this.createStepHandler());
//       fastify.patch('/auth/:plugin/:step', this.createStepHandler());
//       fastify.delete('/auth/:plugin/:step', this.createStepHandler());

//       // Session management routes
//       fastify.get('/session', this.createSessionCheckHandler());
//       fastify.post('/session', this.createSessionCreateHandler());
//       fastify.delete('/session', this.createSessionDestroyHandler());

//       // Plugin introspection routes
//       fastify.get('/plugins', this.createPluginListHandler());
//       fastify.get('/plugins/:plugin', this.createPluginDetailsHandler());

//       // Introspection and health
//       fastify.get('/introspection', this.createIntrospectionHandler());
//       fastify.get('/health', this.createHealthHandler());
//     };
//   }

//   /**
//    * Create step execution handler
//    */
//   private createStepHandler() {
//     return async (
//       request: FastifyRequest,
//       reply: FastifyReply,
//     ): Promise<void> => {
//       try {
//         const httpReq = this.extractRequest(request);
//         const result = await this.adapter.executeAuthStep(httpReq as any);
//         this.sendResponse(reply, result);
//       } catch (error) {
//         this.handleError(reply, error as Error);
//       }
//     };
//   }

//   /**
//    * Create session check handler
//    */
//   private createSessionCheckHandler() {
//     return async (
//       request: FastifyRequest,
//       reply: FastifyReply,
//     ): Promise<void> => {
//       try {
//         const httpReq = this.extractRequest(request);
//         const result = await this.adapter.checkSession(httpReq as any);
//         this.sendResponse(reply, result);
//       } catch (error) {
//         this.handleError(reply, error as Error);
//       }
//     };
//   }

//   /**
//    * Create session creation handler
//    */
//   private createSessionCreateHandler() {
//     return async (
//       request: FastifyRequest,
//       reply: FastifyReply,
//     ): Promise<void> => {
//       try {
//         const httpReq = this.extractRequest(request);
//         const result = await this.adapter.createSession(httpReq as any);
//         this.sendResponse(reply, result, 201);
//       } catch (error) {
//         this.handleError(reply, error as Error);
//       }
//     };
//   }

//   /**
//    * Create session destruction handler
//    */
//   private createSessionDestroyHandler() {
//     return async (
//       request: FastifyRequest,
//       reply: FastifyReply,
//     ): Promise<void> => {
//       try {
//         const httpReq = this.extractRequest(request);
//         const result = await this.adapter.destroySession(httpReq as any);
//         this.sendResponse(reply, result);
//       } catch (error) {
//         this.handleError(reply, error as Error);
//       }
//     };
//   }

//   /**
//    * Create plugin list handler
//    */
//   private createPluginListHandler() {
//     return async (
//       request: FastifyRequest,
//       reply: FastifyReply,
//     ): Promise<void> => {
//       try {
//         const result = await this.adapter.listPlugins();
//         this.sendResponse(reply, result);
//       } catch (error) {
//         this.handleError(reply, error as Error);
//       }
//     };
//   }

//   /**
//    * Create plugin details handler
//    */
//   private createPluginDetailsHandler() {
//     return async (
//       request: FastifyRequest,
//       reply: FastifyReply,
//     ): Promise<void> => {
//       try {
//         const { plugin } = request.params as { plugin: string };
//         const result = await this.adapter.getPlugin(plugin);
//         this.sendResponse(reply, result);
//       } catch (error) {
//         this.handleError(reply, error as Error);
//       }
//     };
//   }

//   /**
//    * Create introspection handler
//    */
//   private createIntrospectionHandler() {
//     return async (
//       request: FastifyRequest,
//       reply: FastifyReply,
//     ): Promise<void> => {
//       try {
//         const result = await this.adapter.getIntrospection();
//         this.sendResponse(reply, result);
//       } catch (error) {
//         this.handleError(reply, error as Error);
//       }
//     };
//   }

//   /**
//    * Create health check handler
//    */
//   private createHealthHandler() {
//     return async (
//       request: FastifyRequest,
//       reply: FastifyReply,
//     ): Promise<void> => {
//       try {
//         const result = await this.adapter.healthCheck();
//         this.sendResponse(reply, result);
//       } catch (error) {
//         this.handleError(reply, error as Error);
//       }
//     };
//   }

//   /**
//    * Get the base adapter instance
//    */
//   getAdapter(): ReAuthHttpAdapterV2 {
//     return this.adapter;
//   }
// }

// /**
//  * Factory function to create Fastify adapter
//  */
// export function createFastifyAdapter(
//   config: HttpAdapterV2Config,
// ): FastifyAdapterV2 {
//   return new FastifyAdapterV2(config);
// }

// /**
//  * Fastify plugin factory function
//  */
// export function fastifyReAuth(config: HttpAdapterV2Config): FastifyPluginAsync {
//   const adapter = new FastifyAdapterV2(config);
//   return adapter.createPlugin();
// }
