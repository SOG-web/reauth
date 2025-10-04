# Fastify Adapter

> **Framework**: [Fastify](https://fastify.dev) - Fast and low overhead web framework
> **Status**: ✅ Production Ready

The Fastify adapter provides high-performance integration between ReAuth and Fastify, leveraging Fastify's speed, schema validation, and plugin architecture.

## Features

- ⚡ **High Performance**: Optimized for speed with minimal overhead
- 📋 **Schema Validation**: Built-in request/response validation with JSON Schema
- 🔌 **Plugin Architecture**: Native Fastify plugin system integration
- 🛡️ **Security**: Fastify's built-in security features and validation
- 📊 **Logging**: Structured logging with Pino integration
- 🚀 **Type Safety**: Full TypeScript support with Fastify types
- 🔄 **Lifecycle Hooks**: Access to Fastify's request lifecycle
- 📈 **Metrics Ready**: Built-in support for performance monitoring

## Installation

```bash
npm install @re-auth/http-adapters fastify
# or
pnpm add @re-auth/http-adapters fastify
# or
yarn add @re-auth/http-adapters fastify
```

## Quick Start

### Basic Setup

```typescript
import Fastify from 'fastify'
import { fastifyReAuth } from '@re-auth/http-adapters'

const fastify = Fastify({
  logger: true
})

// Register ReAuth plugin
fastify.register(fastifyReAuth, {
  engine: reAuthEngine,
  basePath: '/api/auth'
})

fastify.get('/health', async () => {
  return { status: 'ok' }
})

fastify.listen({ port: 3000 }, (err) => {
  if (err) throw err
  console.log('Server running on port 3000')
})
```

### Advanced Configuration

```typescript
import Fastify from 'fastify'
import { fastifyReAuth } from '@re-auth/http-adapters'

const fastify = Fastify({
  logger: {
    level: 'info',
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent']
      })
    }
  },
  disableRequestLogging: false,
  ignoreTrailingSlash: true
})

fastify.register(fastifyReAuth, {
  engine: reAuthEngine,
  basePath: '/auth',
  cors: {
    origin: ['https://app.example.com'],
    credentials: true
  },
  rateLimit: {
    max: 100,
    timeWindow: '15 minutes'
  },
  validation: {
    validateInput: true,
    maxPayloadSize: 1048576 // 1MB
  }
})

// Add custom routes after ReAuth
fastify.get('/api/profile', async (request, reply) => {
  const user = (request as any).user
  if (!user) {
    return reply.status(401).send({ error: 'Authentication required' })
  }
  return { user: user.subject }
})

export default fastify
```

## API Reference

### `fastifyReAuth`

Fastify plugin for ReAuth integration.

```typescript
fastify.register(fastifyReAuth, {
  engine: reAuthEngine,
  basePath: '/api/auth',
  cors: { origin: true },
  rateLimit: { max: 100, timeWindow: '15 minutes' }
})
```

### `fastifyReAuthPlugin`

Alternative plugin registration method.

```typescript
import { fastifyReAuthPlugin } from '@re-auth/http-adapters'

fastify.register(fastifyReAuthPlugin, options)
```

### Configuration Options

```typescript
interface FastifyAdapterConfig {
  engine: ReAuthEngine
  basePath?: string
  cors?: {
    origin?: string | string[] | boolean
    credentials?: boolean
    allowedHeaders?: string[]
    methods?: string[]
    maxAge?: number
  }
  rateLimit?: {
    max?: number
    timeWindow?: string | number
    cache?: number
    skipOnError?: boolean
    keyGenerator?: (req: FastifyRequest) => string
  }
  validation?: {
    validateInput?: boolean
    maxPayloadSize?: number
    allowedFields?: string[]
    sanitizeFields?: string[]
  }
  cookie?: {
    name?: string
    options?: CookieOptions
    refreshTokenName?: string
    refreshOptions?: CookieOptions
  }
}
```

## Usage Examples

### Complete Fastify Application

```typescript
import Fastify from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyRateLimit from '@fastify/rate-limit'
import fastifyHelmet from '@fastify/helmet'
import { fastifyReAuth } from '@re-auth/http-adapters'

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        hostname: req.hostname,
        remoteAddress: req.ip
      })
    }
  }
})

// Security plugins
await fastify.register(fastifyHelmet)
await fastify.register(fastifyCors, {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://myapp.com']
    : true,
  credentials: true
})

await fastify.register(fastifyRateLimit, {
  max: 100,
  timeWindow: '15 minutes',
  keyGenerator: (req) => req.ip
})

// ReAuth plugin
await fastify.register(fastifyReAuth, {
  engine: reAuthEngine,
  basePath: '/api/auth',
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || true,
    credentials: true
  },
  rateLimit: {
    max: 1000,
    timeWindow: '1 hour'
  }
})

// Health check
fastify.get('/health', async () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  }
})

// Protected route
fastify.get('/api/profile', {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          user: { type: 'object' },
          sessionValid: { type: 'boolean' }
        }
      }
    }
  }
}, async (request, reply) => {
  const user = (request as any).user
  if (!user) {
    return reply.status(401).send({ error: 'Authentication required' })
  }

  return {
    user: user.subject,
    sessionValid: user.valid,
    lastLogin: user.metadata?.lastAccessed
  }
})

// Admin route with role check
fastify.get('/api/admin/users', async (request, reply) => {
  const user = (request as any).user
  if (!user || user.subject.role !== 'admin') {
    return reply.status(403).send({ error: 'Admin access required' })
  }

  // Return users list
  return { users: [] }
})

// Error handling
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error)

  if (error.statusCode) {
    return reply.status(error.statusCode).send({
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }

  reply.status(500).send({
    error: 'Internal Server Error',
    timestamp: new Date().toISOString()
  })
})

export default fastify
```

### Schema Validation

```typescript
import { fastifyReAuth } from '@re-auth/http-adapters'

fastify.register(fastifyReAuth, {
  engine: reAuthEngine,
  validation: {
    validateInput: true,
    maxPayloadSize: 1048576
  }
})

// Routes with schema validation
fastify.post('/api/auth/email-password/login', {
  schema: {
    body: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8 }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              subject: { type: 'object' }
            }
          }
        }
      }
    }
  }
}, async (request, reply) => {
  // Request is automatically validated
  const { email, password } = request.body as any
  // ... authentication logic
})
```

### Plugin Composition

```typescript
import fp from 'fastify-plugin'
import { fastifyReAuth } from '@re-auth/http-adapters'

// Create a composite plugin
const authPlugin = fp(async (fastify, opts) => {
  // Register ReAuth
  fastify.register(fastifyReAuth, {
    engine: opts.engine,
    basePath: '/auth'
  })

  // Add custom authentication decorators
  fastify.decorate('authenticate', async function(request, reply) {
    const user = (request as any).user
    if (!user) {
      return reply.status(401).send({ error: 'Authentication required' })
    }
  })

  fastify.decorate('requireRole', function(role: string) {
    return async function(request, reply) {
      const user = (request as any).user
      if (!user || user.subject.role !== role) {
        return reply.status(403).send({ error: `${role} role required` })
      }
    }
  })
})

// Use the composite plugin
fastify.register(authPlugin, { engine: reAuthEngine })

// Routes using decorators
fastify.get('/api/profile', {
  preHandler: fastify.authenticate
}, async (request) => {
  const user = (request as any).user
  return { user: user.subject }
})

fastify.get('/api/admin', {
  preHandler: [fastify.authenticate, fastify.requireRole('admin')]
}, async () => {
  return { message: 'Admin access granted' }
})
```

### Testing with Fastify Inject

```typescript
import { build } from './app.js' // Your Fastify app
import { test } from 'node:test'
import assert from 'node:assert'

test('authentication flow', async (t) => {
  const app = build()

  await t.test('should login user', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/email-password/login',
      payload: {
        email: 'test@example.com',
        password: 'password123'
      }
    })

    assert.strictEqual(response.statusCode, 200)
    const body = JSON.parse(response.payload)
    assert.strictEqual(body.success, true)
    assert.ok(body.data.token)
  })

  await t.test('should access protected route', async () => {
    // First login
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/email-password/login',
      payload: { email: 'test@example.com', password: 'password123' }
    })
    const token = JSON.parse(loginResponse.payload).data.token

    // Access protected route
    const profileResponse = await app.inject({
      method: 'GET',
      url: '/api/profile',
      headers: {
        authorization: `Bearer ${token}`
      }
    })

    assert.strictEqual(profileResponse.statusCode, 200)
    const profile = JSON.parse(profileResponse.payload)
    assert.ok(profile.user)
  })
})
```

## Route Endpoints

### Authentication Steps
```
POST /auth/:plugin/:step
GET  /auth/:plugin/:step
PUT  /auth/:plugin/:step
PATCH /auth/:plugin/:step
DELETE /auth/:plugin/:step
```

### Session Management
```
GET /auth/session     # Check session validity
```

### Introspection (when enabled)
```
GET /auth/plugins           # List all plugins
GET /auth/plugins/:plugin   # Get plugin details
GET /auth/introspection     # Full API introspection
GET /auth/health           # Health check
```

## Response Format

All endpoints return a consistent JSON response:

```typescript
{
  success: boolean
  data?: any
  error?: {
    code: string
    message: string
  }
  meta: {
    timestamp: string
  }
}
```

## TypeScript Support

Full TypeScript support with Fastify types:

```typescript
import { FastifyRequest, FastifyReply } from 'fastify'
import { fastifyReAuth } from '@re-auth/http-adapters'

// Type-safe route handlers
fastify.get('/profile', {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          user: { type: 'object' },
          sessionValid: { type: 'boolean' }
        }
      }
    }
  }
}, async (request: FastifyRequest, reply: FastifyReply) => {
  const user = (request as any).user // Properly typed AuthenticatedUser
  if (!user) {
    return reply.status(401).send({ error: 'Authentication required' })
  }
  return { user: user.subject, sessionValid: user.valid }
})

// Plugin with proper typing
fastify.register(fastifyReAuth, {
  engine: reAuthEngine,
  basePath: '/api/auth',
  cors: {
    origin: true,
    credentials: true
  },
  rateLimit: {
    max: 100,
    timeWindow: '15 minutes'
  }
})
```

## Best Practices

### 1. Plugin Registration Order

```typescript
// Register security plugins first
await fastify.register(fastifyHelmet)
await fastify.register(fastifyCors, corsOptions)
await fastify.register(fastifyRateLimit, rateLimitOptions)

// Then ReAuth
await fastify.register(fastifyReAuth, reAuthOptions)

// Finally custom routes
fastify.get('/api/health', async () => ({ status: 'ok' }))
```

### 2. Schema Validation

```typescript
// Always use schema validation for better performance and security
fastify.post('/api/auth/email-password/login', {
  schema: {
    body: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8, maxLength: 128 }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' }
        }
      }
    }
  }
}, loginHandler)
```

### 3. Error Handling

```typescript
fastify.setErrorHandler((error, request, reply) => {
  request.log.error(error)

  // Handle validation errors
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: error.validation
      }
    })
  }

  // Handle ReAuth errors
  if (error.statusCode >= 400 && error.statusCode < 500) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code || 'CLIENT_ERROR',
        message: error.message
      }
    })
  }

  // Handle server errors
  reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  })
})
```

### 4. Performance Optimization

```typescript
const fastify = Fastify({
  // Disable logging in production for better performance
  disableRequestLogging: process.env.NODE_ENV === 'production',
  // Ignore trailing slashes
  ignoreTrailingSlash: true,
  // Use custom JSON serializer for better performance
  serializerOpts: {
    rounding: 'trunc'
  }
})
```

## Performance Considerations

- **Schema Validation**: Use JSON schemas for automatic validation and serialization
- **Logging**: Disable request logging in production
- **Caching**: Use Fastify's built-in caching for repeated requests
- **Connection Pooling**: Configure proper database connection pooling
- **Monitoring**: Use Fastify's built-in metrics and monitoring hooks

## Troubleshooting

### Common Issues

**Plugin Registration Order**
```typescript
// Plugins must be registered in the correct order
await fastify.register(fastifyCors)    // ✅ First
await fastify.register(fastifyReAuth)  // ✅ Then
fastify.get('/route', handler)         // ✅ After plugins
```

**Schema Validation Errors**
```typescript
// Ensure schemas are correct
fastify.post('/auth/login', {
  schema: {
    body: {
      type: 'object',
      required: ['email', 'password'], // Required fields
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string' }
      }
    }
  }
}, handler)
```

**User Not Available**
```typescript
// ReAuth must be registered before accessing user
await fastify.register(fastifyReAuth, options)
// Now user is available in subsequent routes
fastify.get('/profile', async (request) => {
  const user = (request as any).user // ✅ Available
})
```

**Rate Limiting Not Working**
```typescript
// Rate limiting plugin must be registered before ReAuth
await fastify.register(fastifyRateLimit, options) // ✅ First
await fastify.register(fastifyReAuth, options)    // ✅ Then
```

## License

MIT
