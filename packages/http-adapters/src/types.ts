import { AuthOutput, ReAuthEngine, Token } from '@re-auth/reauth';
import { ReAuthJWTPayload } from '@re-auth/reauth/services';
import { CookiePrefixOptions } from 'hono/utils/cookie';

// Base HTTP adapter configuration
export interface HttpAdapterConfig {
  engine: ReAuthEngine;
  basePath?: string;
  cors?: CorsConfig;
  rateLimit?: RateLimitConfig;
  security?: SecurityConfig;
  validation?: ValidationConfig;
  cookie?: {
    name: string;
    refreshTokenName?: string;
    options: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: 'lax' | 'strict' | 'none';
      path?: string;
      domain?: string;
      maxAge?: number; // in seconds
      expires?: Date;
      partitioned?: boolean;
      prefix?: CookiePrefixOptions;
      priority?: 'low' | 'medium' | 'high';
    };
    refreshOptions?: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: 'lax' | 'strict' | 'none';
      path?: string;
      domain?: string;
      maxAge?: number; // in seconds
      expires?: Date;
      partitioned?: boolean;
      prefix?: CookiePrefixOptions;
      priority?: 'low' | 'medium' | 'high';
    };
  };
  headerToken?: {
    accesssTokenHeader: string;
    refreshTokenHeader?: string;
  };
}

// CORS configuration
export interface CorsConfig {
  origin?:
    | string
    | string[]
    | boolean
    | ((
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => void);
  credentials?: boolean;
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  methods?: string[];
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

// Rate limiting configuration
export interface RateLimitConfig {
  windowMs?: number;
  max?: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (request: any) => string;
}

// Security configuration
export interface SecurityConfig {
  helmet?: boolean | HelmetConfig;
  csrf?: boolean | CsrfConfig;
  sanitizeInput?: boolean;
  sanitizeOutput?: boolean;
}

export interface HelmetConfig {
  contentSecurityPolicy?: boolean | object;
  crossOriginEmbedderPolicy?: boolean;
  crossOriginOpenerPolicy?: boolean;
  crossOriginResourcePolicy?: boolean;
  dnsPrefetchControl?: boolean;
  frameguard?: boolean | object;
  hidePoweredBy?: boolean;
  hsts?: boolean | object;
  ieNoOpen?: boolean;
  noSniff?: boolean;
  originAgentCluster?: boolean;
  permittedCrossDomainPolicies?: boolean;
  referrerPolicy?: boolean | object;
  xssFilter?: boolean;
}

export interface CsrfConfig {
  secret?: string;
  cookie?: boolean | object;
  sessionKey?: string;
  value?: (req: any) => string;
}

// Input validation configuration
export interface ValidationConfig {
  validateInput?: boolean;
  validateOutput?: boolean;
  maxPayloadSize?: number;
  allowedFields?: string[];
  sanitizeFields?: string[];
}

// HTTP request/response types for framework abstraction
export interface HttpRequest {
  method: string;
  url: string;
  path: string;
  query: Record<string, any>;
  params: Record<string, string>;
  body: any;
  headers: Record<string, string>;
  cookies?: Record<string, string>;
  ip?: string;
  userAgent?: string;
  // Current authenticated user information
  user?: AuthenticatedUser | null;
}

// Authenticated user information from session
export interface AuthenticatedUser {
  /** The authenticated subject from the session */
  subject: any;
  /** The session token */
  token: Token;
  /** Whether the session is valid */
  valid: boolean;
  /** Session metadata */
  metadata?: {
    payload?: ReAuthJWTPayload;
    type?: 'jwt' | 'legacy' | undefined;
    // Add any other metadata fields as needed
    [key: string]: any;
  };
}

export interface HttpResponse {
  status(code: number): this;
  json(data: any): this;
  send(data: any): this;
  header(name: string, value: string): this;
  cookie(name: string, value: string, options?: any): this;
  clearCookie(name: string, options?: any): this;
}

// Framework adapter interface
export interface FrameworkAdapter<
  TRequest = any,
  TResponse = any,
  TNext = any,
> {
  name: string;
  createMiddleware(): (
    req: TRequest,
    res: TResponse,
    next: TNext,
  ) => Promise<void> | void;
  createUserMiddleware(): (
    req: TRequest,
    res: TResponse,
    next: TNext,
  ) => Promise<void> | void;
  extractRequest(req: TRequest): HttpRequest;
  sendResponse(res: TResponse, data: any, statusCode?: number): void;
  handleError(res: TResponse, error: Error, statusCode?: number): void;
  getCurrentUser(req: TRequest): Promise<AuthenticatedUser | null>;
}

// Route handler types
export interface RouteHandler {
  (req: HttpRequest, res: HttpResponse): Promise<any> | any;
}

export interface AuthStepRequest extends HttpRequest {
  params: Record<string, string>;
  plugin: {
    name: string;
    step: string;
  };
}

export interface SessionRequest extends HttpRequest {
  headers: Record<string, string> & {
    authorization?: string;
  };
}

// Plugin endpoint metadata
export interface PluginEndpoint {
  pluginName: string;
  stepName: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  requiresAuth: boolean;
  description?: string;
  inputSchema?: any;
  outputSchema?: any;
}

// HTTP adapter response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
    };
  };
}

export interface AuthStepResponse extends ApiResponse<AuthOutput> {
  data?: AuthOutput & {
    nextStep?: string;
    requiresRedirect?: boolean;
    sessionToken?: Token;
  };
  status: number;
  /** Redirect URL for OAuth flows */
  redirect?: string;
  /** Secret data (cookies) to set for OAuth flows */
  secret?: Record<string, string>;
}

export interface SessionResponse extends ApiResponse {
  data?: {
    valid: boolean;
    subject?: any;
    token?: Token;
    expiresAt?: string;
    metadata?: {
      payload?: ReAuthJWTPayload;
      type?: 'jwt' | 'legacy' | undefined;
      // Add any other metadata fields as needed
      [key: string]: any;
    };
  };
}

export interface PluginListResponse extends ApiResponse {
  data?: Array<{
    name: string;
    description: string;
    steps: Array<{
      name: string;
      description?: string;
      method: string;
      path: string;
      requiresAuth: boolean;
    }>;
  }>;
}

// Middleware types
export interface MiddlewareFunction<
  TRequest = any,
  TResponse = any,
  TNext = any,
> {
  (req: TRequest, res: TResponse, next: TNext): Promise<void> | void;
}

export interface SecurityMiddleware {
  cors(): MiddlewareFunction;
  rateLimit(): MiddlewareFunction;
  helmet(): MiddlewareFunction;
  validation(): MiddlewareFunction;
}

// Error types
export class HttpAdapterError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: any,
  ) {
    super(message);
    this.name = 'HttpAdapterError';
  }
}

export class ValidationError extends HttpAdapterError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends HttpAdapterError {
  constructor(message: string, details?: any) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends HttpAdapterError {
  constructor(message: string, details?: any) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends HttpAdapterError {
  constructor(message: string, details?: any) {
    super(message, 404, 'NOT_FOUND', details);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends HttpAdapterError {
  constructor(message: string, details?: any) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', details);
    this.name = 'RateLimitError';
  }
}
