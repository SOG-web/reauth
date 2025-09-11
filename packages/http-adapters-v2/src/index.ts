// Core exports
export { ReAuthHttpAdapterV2 } from './base-adapter.js';

// Types
export type {
  HttpAdapterV2Config,
  CorsConfig,
  RateLimitConfig,
  SecurityConfig,
  ValidationConfig,
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
  MiddlewareFunction,
  SecurityMiddleware,
} from './types.js';

// Error classes
export {
  HttpAdapterError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
} from './types.js';

// Framework adapters
export {
  ExpressAdapterV2,
  createExpressAdapter,
  expressReAuth,
} from './adapters/express.js';

export {
  FastifyAdapterV2,
  createFastifyAdapter,
  fastifyReAuth,
} from './adapters/fastify.js';

export {
  HonoAdapterV2,
  createHonoAdapter,
  honoReAuth,
} from './adapters/hono.js';

// Middleware
export {
  createCorsMiddleware,
  createRateLimitMiddleware,
  createSecurityMiddleware,
  createValidationMiddleware,
  createSecurityMiddlewares,
} from './middleware/security.js';

// Utilities
export {
  createReAuthHttpAdapter,
  generateApiSpec,
  getPluginNames,
  groupEndpointsByPlugin,
  validateConfig,
} from './utils/factory.js';

// Main factory function for easy setup
export function createHttpAdapterV2(config: {
  engine: import('@re-auth/reauth').ReAuthEngineV2;
  framework: 'express' | 'fastify' | 'hono';
  basePath?: string;
  cors?: CorsConfig;
  rateLimit?: RateLimitConfig;
  security?: SecurityConfig;
  validation?: ValidationConfig;
}) {
  const { framework, ...adapterConfig } = config;
  
  switch (framework) {
    case 'express':
      return createExpressAdapter(adapterConfig);
    case 'fastify':
      return createFastifyAdapter(adapterConfig);
    case 'hono':
      return createHonoAdapter(adapterConfig);
    default:
      throw new Error(`Unsupported framework: ${framework}`);
  }
}

// Re-export types from @re-auth/reauth for convenience
export type {
  ReAuthEngineV2,
  AuthPluginV2,
  AuthStepV2,
  AuthInput,
  AuthOutput,
} from '@re-auth/reauth';