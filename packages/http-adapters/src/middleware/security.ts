import type {
  CorsConfig,
  RateLimitConfig,
  SecurityConfig,
  ValidationConfig,
  MiddlewareFunction,
} from '../types';

/**
 * CORS middleware factory
 */
export function createCorsMiddleware(
  config: CorsConfig = {},
): MiddlewareFunction {
  const {
    origin = '*',
    credentials = false,
    allowedHeaders = ['Content-Type', 'Authorization'],
    exposedHeaders = [],
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    preflightContinue = false,
    optionsSuccessStatus = 204,
  } = config;

  return (req: any, res: any, next: any) => {
    // Handle origin
    if (typeof origin === 'string') {
      res.header('Access-Control-Allow-Origin', origin);
    } else if (typeof origin === 'boolean') {
      res.header('Access-Control-Allow-Origin', origin ? '*' : 'false');
    } else if (Array.isArray(origin)) {
      const requestOrigin = req.headers.origin;
      if (requestOrigin && origin.includes(requestOrigin)) {
        res.header('Access-Control-Allow-Origin', requestOrigin);
      }
    } else if (typeof origin === 'function') {
      const requestOrigin = req.headers.origin;
      origin(requestOrigin, (err, allow) => {
        if (err) {
          return next(err);
        }
        if (allow) {
          res.header('Access-Control-Allow-Origin', requestOrigin || '*');
        }
      });
    }

    // Handle credentials
    if (credentials) {
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    // Handle methods
    res.header('Access-Control-Allow-Methods', methods.join(', '));

    // Handle headers
    if (allowedHeaders.length > 0) {
      res.header('Access-Control-Allow-Headers', allowedHeaders.join(', '));
    }

    if (exposedHeaders.length > 0) {
      res.header('Access-Control-Expose-Headers', exposedHeaders.join(', '));
    }

    // Handle preflight
    if (req.method === 'OPTIONS') {
      if (!preflightContinue) {
        res.status(optionsSuccessStatus).end();
        return;
      }
    }

    next();
  };
}

/**
 * Rate limiting middleware factory
 */
export function createRateLimitMiddleware(
  config: RateLimitConfig = {},
): MiddlewareFunction {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100,
    message = 'Too many requests, please try again later.',
    standardHeaders = true,
    legacyHeaders = false,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = (req: any) => req.ip || 'anonymous',
  } = config;

  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: any, res: any, next: any) => {
    const key = keyGenerator(req);
    const now = Date.now();
    const resetTime = now + windowMs;

    // Clean up expired entries
    for (const [k, v] of requests.entries()) {
      if (v.resetTime <= now) {
        requests.delete(k);
      }
    }

    // Get or create request info
    let requestInfo = requests.get(key);
    if (!requestInfo || requestInfo.resetTime <= now) {
      requestInfo = { count: 0, resetTime };
      requests.set(key, requestInfo);
    }

    // Check rate limit
    if (requestInfo.count >= max) {
      if (standardHeaders) {
        res.header('X-RateLimit-Limit', max.toString());
        res.header('X-RateLimit-Remaining', '0');
        res.header(
          'X-RateLimit-Reset',
          new Date(requestInfo.resetTime).toISOString(),
        );
      }

      if (legacyHeaders) {
        res.header('X-Rate-Limit-Limit', max.toString());
        res.header('X-Rate-Limit-Remaining', '0');
        res.header(
          'X-Rate-Limit-Reset',
          new Date(requestInfo.resetTime).toISOString(),
        );
      }

      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Increment counter
    requestInfo.count++;

    // Set headers
    if (standardHeaders) {
      res.header('X-RateLimit-Limit', max.toString());
      res.header('X-RateLimit-Remaining', (max - requestInfo.count).toString());
      res.header(
        'X-RateLimit-Reset',
        new Date(requestInfo.resetTime).toISOString(),
      );
    }

    if (legacyHeaders) {
      res.header('X-Rate-Limit-Limit', max.toString());
      res.header(
        'X-Rate-Limit-Remaining',
        (max - requestInfo.count).toString(),
      );
      res.header(
        'X-Rate-Limit-Reset',
        new Date(requestInfo.resetTime).toISOString(),
      );
    }

    next();
  };
}

/**
 * Security headers middleware factory
 */
export function createSecurityMiddleware(
  config: SecurityConfig = {},
): MiddlewareFunction {
  const { helmet = true } = config;

  return (req: any, res: any, next: any) => {
    if (helmet) {
      // Basic security headers
      res.header('X-Content-Type-Options', 'nosniff');
      res.header('X-Frame-Options', 'DENY');
      res.header('X-XSS-Protection', '1; mode=block');
      res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.header(
        'Permissions-Policy',
        'geolocation=(), microphone=(), camera=()',
      );

      // HSTS for HTTPS
      if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        res.header(
          'Strict-Transport-Security',
          'max-age=31536000; includeSubDomains',
        );
      }
    }

    next();
  };
}

/**
 * Input validation middleware factory
 */
export function createValidationMiddleware(
  config: ValidationConfig = {},
): MiddlewareFunction {
  const {
    validateInput = true,
    maxPayloadSize = 1024 * 1024, // 1MB
    allowedFields = [],
    sanitizeFields = ['email', 'username', 'name'],
  } = config;

  return (req: any, res: any, next: any) => {
    if (!validateInput) {
      return next();
    }

    // Check payload size
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > maxPayloadSize) {
      return res.status(413).json({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: `Payload too large. Maximum size is ${maxPayloadSize} bytes.`,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Sanitize input
    if (req.body && typeof req.body === 'object') {
      for (const field of sanitizeFields) {
        if (req.body[field] && typeof req.body[field] === 'string') {
          // Basic sanitization - remove HTML tags and trim
          req.body[field] = req.body[field].replace(/<[^>]*>/g, '').trim();
        }
      }

      // Filter allowed fields if specified
      if (allowedFields.length > 0) {
        const filtered: any = {};
        for (const field of allowedFields) {
          if (req.body[field] !== undefined) {
            filtered[field] = req.body[field];
          }
        }
        req.body = filtered;
      }
    }

    next();
  };
}

/**
 * Create all security middleware
 */
export function createSecurityMiddlewares(config: {
  cors?: CorsConfig;
  rateLimit?: RateLimitConfig;
  security?: SecurityConfig;
  validation?: ValidationConfig;
}): MiddlewareFunction[] {
  const middlewares: MiddlewareFunction[] = [];

  if (config.security) {
    middlewares.push(createSecurityMiddleware(config.security));
  }

  if (config.cors) {
    middlewares.push(createCorsMiddleware(config.cors));
  }

  if (config.rateLimit) {
    middlewares.push(createRateLimitMiddleware(config.rateLimit));
  }

  if (config.validation) {
    middlewares.push(createValidationMiddleware(config.validation));
  }

  return middlewares;
}
