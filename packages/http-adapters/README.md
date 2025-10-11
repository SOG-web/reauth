# @re-auth/http-adapters-v2

V2 HTTP protocol adapters for ReAuth - framework-agnostic integration with Express, Fastify, and Hono.

## Features

- 🚀 **Framework Agnostic**: Support for Express, Fastify, and Hono
- 🔒 **Security First**: Built-in CORS, rate limiting, and security headers
- 🛡️ **Type Safe**: Full TypeScript integration with V2 engine types
- 🔌 **Plugin Aware**: Automatically discovers and exposes V2 plugin endpoints
- 👤 **User Access**: Easy current user retrieval with middleware and utilities
- 📊 **Introspection**: Built-in API documentation and health checks
- ⚡ **Performance**: Optimized for high-throughput scenarios

## Installation

```bash
npm install @re-auth/http-adapters-v2
# or
pnpm add @re-auth/http-adapters-v2
# or
yarn add @re-auth/http-adapters-v2
```

## Quick Start

### Express.js

```typescript
import express from 'express';
import { ReAuthEngineV2 } from '@re-auth/reauth';
import { createExpressAdapter } from '@re-auth/http-adapters-v2';
import { createDefaultLogger } from '@re-auth/logger';

const app = express();

// Create logger instance
const logger = createDefaultLogger({
  prefix: 'MyApp',
  enabledTags: ['auth', 'session', 'http']
});

const engine = new ReAuthEngineV2({
  /* config */,
  logger: logger  // Required logger instance
});

// Create adapter with device info extraction
const adapter = createExpressAdapter({
  engine,
  basePath: '/api/auth',
  cors: {
    origin: ['https://app.example.com'],
    credentials: true
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100
  }
}, false, async (req) => {
  // Extract device information for enhanced security
  return {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    fingerprint: req.get('X-Request-ID'),
    geoLocation: req.get('CF-IPCountry'),
    deviceType: req.get('CF-Device-Type'),
    sessionId: req.session?.id,
  };
});

app.use('/api/auth', adapter.createRouter());

// Enable user population on all requests (optional)
app.use(adapter.createUserMiddleware());

app.listen(3000);
```

### Fastify

```typescript
import Fastify from 'fastify';
import { ReAuthEngineV2 } from '@re-auth/reauth';
import { createFastifyAdapter } from '@re-auth/http-adapters-v2';

const fastify = Fastify();
const engine = new ReAuthEngineV2({
  /* config */
});

// Create adapter with device info extraction
const adapter = createFastifyAdapter(
  {
    engine,
    basePath: '/api/auth',
  },
  async (request) => {
    // Extract device information for enhanced security
    return {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      fingerprint: request.headers['x-request-id'],
      geoLocation: request.headers['cf-ipcountry'],
      deviceType: request.headers['cf-device-type'],
    };
  },
);

fastify.register(adapter.createPlugin());

// Enable user population on all requests (optional)
fastify.register(adapter.createUserPlugin());

fastify.listen({ port: 3000 });
```

### Hono

```typescript
import { Hono } from 'hono';
import { ReAuthEngineV2 } from '@re-auth/reauth';
import { createHonoAdapter } from '@re-auth/http-adapters-v2';
import { createDefaultLogger } from '@re-auth/logger';

const app = new Hono();

// Create logger instance
const logger = createDefaultLogger({
  prefix: 'MyApp',
  enabledTags: ['auth', 'session', 'http']
});

const engine = new ReAuthEngineV2({
  /* config */,
  logger: logger  // Required logger instance
});

// Create adapter with device info extraction
const adapter = createHonoAdapter({
  engine,
  basePath: '/api/auth'
}, async (c) => {
  // Extract device information for enhanced security
  return {
    ip: c.env?.CF_CONNECTING_IP || c.req.header('x-forwarded-for'),
    userAgent: c.req.header('user-agent'),
    fingerprint: c.req.header('cf-ray'),
    country: c.req.header('cf-ipcountry'),
    deviceType: c.req.header('cf-device-type'),
    timezone: c.req.header('cf-timezone'),
  };
});

adapter.registerRoutes(app, '/api/auth');

// Enable user population on all requests (optional)
app.use('*', adapter.createUserMiddleware());

// or use a standalone app
// const authApp = adapter.createApp();
// app.route('/api/auth', authApp);
```

## Device Info Extraction

Device information extraction is a core security feature that allows you to capture and analyze request metadata for enhanced authentication, fraud prevention, and analytics. All adapters support customizable device info extraction through their constructor parameters.

### Why Device Info Matters

Device information enables:

- **Geographic Analysis**: Track user locations and detect suspicious access patterns
- **Device Fingerprinting**: Identify and validate trusted devices
- **Security Monitoring**: Detect unusual access patterns or potential breaches
- **Analytics**: Gather insights about user behavior and platform usage
- **Compliance**: Meet regulatory requirements for access logging

### Express.js Example

```typescript
const adapter = createExpressAdapter(config, false, async (req) => {
  return {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    fingerprint: req.get('X-Request-ID'),
    geoLocation: req.get('CF-IPCountry'),
    deviceType: req.get('CF-Device-Type'),
    sessionId: req.session?.id,
    browserFingerprint: req.get('X-Browser-Fingerprint'),
  };
});
```

### Fastify Example

```typescript
const adapter = createFastifyAdapter(config, async (request) => {
  return {
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    fingerprint: request.headers['x-request-id'],
    geoLocation: request.headers['cf-ipcountry'],
    deviceType: request.headers['cf-device-type'],
    timezone: request.headers['cf-timezone'],
  };
});
```

### Hono Example

```typescript
const adapter = createHonoAdapter(config, async (c) => {
  return {
    ip: c.env?.CF_CONNECTING_IP || c.req.header('x-forwarded-for'),
    userAgent: c.req.header('user-agent'),
    fingerprint: c.req.header('cf-ray'),
    country: c.req.header('cf-ipcountry'),
    deviceType: c.req.header('cf-device-type'),
    timezone: c.req.header('cf-timezone'),
    datacenter: c.req.header('cf-ray')?.split('-')[0],
  };
});
```

### Advanced Device Info

For comprehensive device analysis, you can extract extensive metadata:

```typescript
const deviceInfoExtractor = async (request) => {
  // Framework-specific extraction logic
  const basicInfo = extractBasicInfo(request);

  // Additional processing
  const enhancedInfo = await enrichDeviceInfo(basicInfo);

  // Database lookups, external API calls, etc.
  const riskScore = await calculateRiskScore(enhancedInfo);

  return {
    ...enhancedInfo,
    riskScore,
    trustLevel: riskScore < 0.3 ? 'high' : riskScore < 0.7 ? 'medium' : 'low',
    lastSeen: new Date().toISOString(),
  };
};
```

### Best Practices

1. **Privacy Compliance**: Ensure device info collection complies with privacy regulations (GDPR, CCPA, etc.)
2. **Minimal Collection**: Only collect what's necessary for your security and analytics needs
3. **Secure Storage**: Handle sensitive device data appropriately
4. **Performance**: Keep device info extraction fast to avoid impacting response times
5. **Error Handling**: Gracefully handle extraction failures

## Full Examples

Complete examples with detailed configurations are available in the `examples/` directory:

- **[Express Example](./examples/express-example.ts)** - Full Express.js integration with middleware, security, and error handling
- **[Fastify Example](./examples/fastify-example.ts)** - High-performance Fastify setup with schema validation
- **[Hono Example](./examples/hono-example.ts)** - Edge-optimized Hono deployment for serverless environments

## Getting Current User

The V2 HTTP adapters provide multiple ways to access the current authenticated user in your route handlers.

### Method 1: Using User Middleware (Recommended)

Automatically populate user information on all requests:

#### Express.js

```typescript
// Add user middleware globally
app.use(adapter.createUserMiddleware());

// Access user in any route handler
app.get('/api/profile', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  res.json({
    message: 'Profile data',
    user: req.user.subject,
    sessionValid: req.user.valid,
  });
});
```

#### Fastify

```typescript
// Register user plugin globally
fastify.register(adapter.createUserPlugin());

// Access user in any route handler
fastify.get('/api/profile', async (request, reply) => {
  const user = (request as any).user;

  if (!user) {
    return reply.status(401).send({ error: 'Authentication required' });
  }

  return {
    message: 'Profile data',
    user: user.subject,
    sessionValid: user.valid,
  };
});
```

#### Hono

```typescript
// Add user middleware globally
app.use('*', adapter.createUserMiddleware());

// Access user in any route handler
app.get('/api/profile', (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  return c.json({
    message: 'Profile data',
    user: user.subject,
    sessionValid: user.valid,
  });
});
```

### Method 2: Manual User Lookup

Check for current user when needed:

```typescript
// Express
app.get('/api/dashboard', async (req, res) => {
  const user = await adapter.getCurrentUser(req);

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  res.json({ user: user.subject });
});

// Fastify
fastify.get('/api/dashboard', async (request, reply) => {
  const user = await adapter.getCurrentUser(request);

  if (!user) {
    return reply.status(401).send({ error: 'Authentication required' });
  }

  return { user: user.subject };
});

// Hono
app.get('/api/dashboard', async (c) => {
  const user = await adapter.getCurrentUser(c);

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  return c.json({ user: user.subject });
});
```

### Method 3: Optional Authentication

Handle routes that work with or without authentication:

```typescript
app.get('/api/content', async (req, res) => {
  const user = await adapter.getCurrentUser(req);

  res.json({
    message: 'Content data',
    isAuthenticated: !!user,
    user: user?.subject || null,
    content: user ? 'Premium content' : 'Public content',
  });
});
```

### AuthenticatedUser Type

The user object contains:

```typescript
interface AuthenticatedUser {
  subject: any; // The authenticated user data from the session
  token: string; // The session token
  valid: boolean; // Whether the session is valid
  metadata?: {
    // Optional session metadata
    expiresAt?: string;
    createdAt?: string;
    lastAccessed?: string;
    [key: string]: any;
  };
}
```

### Session Token Sources

The adapters automatically check for session tokens in:

1. **Authorization header**: `Bearer <token>`
2. **Cookies**: `reauth-session=<token>`
3. **Request body**: `{ "token": "<token>" }`

## 📝 Logging

HTTP adapters provide comprehensive logging for all HTTP operations, authentication flows, and middleware execution. All adapters require a logger instance to be passed to the ReAuth engine.

### Logger Setup

```typescript
import { createDefaultLogger } from '@re-auth/logger';

// Create logger with HTTP-specific tags
const logger = createDefaultLogger({
  prefix: 'MyApp',
  prefixEnv: 'REAUTH_',
  enabledTags: ['auth', 'session', 'http'],
  timestampFormat: 'human',
  emojis: true
});

// Pass to ReAuth engine
const engine = new ReAuthEngine({
  /* config */,
  logger: logger  // Required
});
```

### HTTP-Specific Log Tags

- **`http`** - HTTP adapter operations (requests, responses, middleware)
- **`request`** - Incoming HTTP requests
- **`response`** - HTTP responses and status codes
- **`middleware`** - Middleware execution and authentication checks
- **`error`** - HTTP errors and exception handling

### Environment Variable Control

```bash
# Enable HTTP and authentication logging
REAUTH_DEBUG=http,auth,session

# Enable all logging
REAUTH_DEBUG=*

# Production logging (JSON format)
NODE_ENV=production
```

### Log Examples

```typescript
// Development output
[10:30:00am 15 Jan 2024] [MyApp] [http] ℹ️ POST /api/auth/login
[10:30:01am 15 Jan 2024] [MyApp] [auth] ✅ User authentication successful
[10:30:01am 15 Jan 2024] [MyApp] [http] ✅ 200 OK response

// Production output (JSON)
{"level":"info","tags":["http"],"message":"POST /api/auth/login","timestamp":"2024-01-15T10:30:00.000Z","prefix":"MyApp"}
{"level":"info","tags":["auth"],"message":"User authentication successful","timestamp":"2024-01-15T10:30:01.000Z","prefix":"MyApp"}
```

## Configuration

### Basic Configuration

```typescript
import { createHttpAdapterV2 } from '@re-auth/http-adapters-v2';

const adapter = createHttpAdapterV2({
  engine: reAuthEngine,
  framework: 'express', // 'express' | 'fastify' | 'hono'
  basePath: '/api/v2',
  cors: {
    origin: ['https://app.example.com'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests per window
    message: 'Too many requests, please try again later.',
  },
  security: {
    helmet: true, // Enable security headers
    csrf: false, // Disable CSRF (for API-only usage)
    sanitizeInput: true,
    sanitizeOutput: false,
  },
  validation: {
    validateInput: true,
    maxPayloadSize: 1024 * 1024, // 1MB
    allowedFields: [], // Empty = allow all
    sanitizeFields: ['email', 'username', 'name'],
  },
});
```

### Advanced Configuration

```typescript
const adapter = createExpressAdapter({
  engine: reAuthEngine,
  basePath: '/auth',
  cors: {
    origin: (origin, callback) => {
      // Custom origin validation
      const allowedOrigins = ['https://app.example.com', 'https://admin.example.com'];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: (req) => (req.user?.isPremium ? 1000 : 100), // Dynamic limits
    keyGenerator: (req) => `${req.ip}:${req.headers['user-agent']}`,
    skipSuccessfulRequests: true,
  },
  security: {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
    },
  },
});
```

## API Endpoints

### Authentication Steps

Execute plugin-specific authentication steps:

```
POST /auth/:plugin/:step
GET /auth/:plugin/:step
PUT /auth/:plugin/:step
PATCH /auth/:plugin/:step
DELETE /auth/:plugin/:step
```

Example:

```bash
curl -X POST http://localhost:3000/api/auth/email-password/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "secret"}'
```

### Session Management

```
GET /session      # Check session validity
POST /session     # Create new session
DELETE /session   # Destroy current session
```

### Plugin Introspection

```
GET /plugins           # List all plugins
GET /plugins/:plugin   # Get plugin details
```

### System

```
GET /introspection  # Full API introspection
GET /health        # Health check
```

## Response Format

All endpoints return a consistent response format:

```typescript
{
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    timestamp: string;
    requestId?: string;
  };
}
```

### Success Response

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "subject": {
      "id": "user123",
      "email": "user@example.com"
    }
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "field": "email",
      "value": "invalid-email"
    }
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## Security Features

### CORS

```typescript
cors: {
  origin: ['https://app.example.com'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}
```

### Rate Limiting

```typescript
rateLimit: {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // requests per window
  keyGenerator: (req) => req.ip,
  skipSuccessfulRequests: false
}
```

### Security Headers

```typescript
security: {
  helmet: true, // Enables:
  // - X-Content-Type-Options: nosniff
  // - X-Frame-Options: DENY
  // - X-XSS-Protection: 1; mode=block
  // - Referrer-Policy: strict-origin-when-cross-origin
  // - Strict-Transport-Security (HTTPS only)
}
```

### Input Validation

```typescript
validation: {
  validateInput: true,
  maxPayloadSize: 1024 * 1024, // 1MB
  sanitizeFields: ['email', 'username', 'name'],
  allowedFields: [] // Empty = allow all
}
```

## Error Handling

The adapter provides comprehensive error handling with specific error types:

```typescript
import { HttpAdapterError, ValidationError, AuthenticationError, AuthorizationError, NotFoundError, RateLimitError } from '@re-auth/http-adapters-v2';

// Custom error handling
app.use((err, req, res, next) => {
  if (err instanceof ValidationError) {
    res.status(400).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }
  // ... handle other error types
});
```

## Migration from V1

The V2 adapter is designed to work alongside V1 adapters. Key differences:

1. **Engine Integration**: Uses `ReAuthEngineV2` instead of `ReAuthEngine`
2. **Plugin Discovery**: Automatically discovers V2 plugins and their steps
3. **Type Safety**: Enhanced TypeScript integration
4. **Response Format**: Consistent JSON response format
5. **Security**: Built-in security features

### Migration Steps

1. Install the V2 adapter package
2. Update your engine to `ReAuthEngineV2`
3. Replace V1 adapter imports with V2 equivalents
4. Update configuration format
5. Test endpoints and response formats

## License

MIT
