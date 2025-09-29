// Core exports
export { ReAuthHttpAdapter } from './base-adapter';

// Types
export type {
  HttpAdapterConfig,
  CorsConfig,
  RateLimitConfig,
  SecurityConfig,
  ValidationConfig,
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
  MiddlewareFunction,
  SecurityMiddleware,
  AuthenticatedUser,
} from './types';

// Error classes
export {
  HttpAdapterError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
} from './types';

// Framework adapters
export {
  ExpressAdapter,
  createExpressAdapter,
  expressReAuth,
} from './adapters/express';

export { HonoAdapter, honoReAuth } from './adapters/hono';

// Middleware
export {
  createCorsMiddleware,
  createRateLimitMiddleware,
  createSecurityMiddleware,
  createValidationMiddleware,
  createSecurityMiddlewares,
} from './middleware/security';

// Utilities
export {
  createReAuthHttpAdapter,
  generateApiSpec,
  getPluginNames,
  groupEndpointsByPlugin,
  validateConfig,
} from './utils/factory';
