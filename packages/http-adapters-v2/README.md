# @re-auth/http-adapters-v2

V2 HTTP protocol adapters for ReAuth - framework-agnostic integration with Express, Fastify, and Hono.

## Features

- 🚀 **Framework Agnostic**: Support for Express, Fastify, and Hono
- 🔒 **Security First**: Built-in CORS, rate limiting, and security headers
- 🛡️ **Type Safe**: Full TypeScript integration with V2 engine types
- 🔌 **Plugin Aware**: Automatically discovers and exposes V2 plugin endpoints
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

const app = express();
const engine = new ReAuthEngineV2({ /* config */ });

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
});

app.use('/api/auth', adapter.createRouter());
app.listen(3000);
```

### Fastify

```typescript
import Fastify from 'fastify';
import { ReAuthEngineV2 } from '@re-auth/reauth';
import { createFastifyAdapter } from '@re-auth/http-adapters-v2';

const fastify = Fastify();
const engine = new ReAuthEngineV2({ /* config */ });

const adapter = createFastifyAdapter({
  engine,
  basePath: '/api/auth'
});

fastify.register(adapter.createPlugin());
fastify.listen({ port: 3000 });
```

### Hono

```typescript
import { Hono } from 'hono';
import { ReAuthEngineV2 } from '@re-auth/reauth';
import { createHonoAdapter } from '@re-auth/http-adapters-v2';

const app = new Hono();
const engine = new ReAuthEngineV2({ /* config */ });

const adapter = createHonoAdapter({
  engine,
  basePath: '/api/auth'
});

adapter.registerRoutes(app, '/api/auth');
// or use a standalone app
// const authApp = adapter.createApp();
// app.route('/api/auth', authApp);
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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests per window
    message: 'Too many requests, please try again later.'
  },
  security: {
    helmet: true, // Enable security headers
    csrf: false, // Disable CSRF (for API-only usage)
    sanitizeInput: true,
    sanitizeOutput: false
  },
  validation: {
    validateInput: true,
    maxPayloadSize: 1024 * 1024, // 1MB
    allowedFields: [], // Empty = allow all
    sanitizeFields: ['email', 'username', 'name']
  }
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
    credentials: true
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: (req) => req.user?.isPremium ? 1000 : 100, // Dynamic limits
    keyGenerator: (req) => `${req.ip}:${req.headers['user-agent']}`,
    skipSuccessfulRequests: true
  },
  security: {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"]
        }
      }
    }
  }
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
import {
  HttpAdapterError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError
} from '@re-auth/http-adapters-v2';

// Custom error handling
app.use((err, req, res, next) => {
  if (err instanceof ValidationError) {
    res.status(400).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
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