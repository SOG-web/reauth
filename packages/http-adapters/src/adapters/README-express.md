# Express Adapter

> **Framework**: [Express.js](https://expressjs.com) - Node.js Web Framework
> **Status**: ✅ Production Ready

The Express adapter provides seamless integration between ReAuth and Express.js, offering the full power of Express middleware, routing, and ecosystem compatibility.

## Features

- 🏗️ **Full Express Integration**: Complete Express.js middleware and routing support
- 🔒 **Security Middleware**: Built-in security headers, CSRF protection, and input validation
- 🚦 **Rate Limiting**: Flexible rate limiting with custom strategies
- 🛡️ **Input Validation**: Request validation and sanitization
- 📊 **Request Logging**: Comprehensive request/response logging
- 🔄 **Middleware Stack**: Full access to Express middleware ecosystem
- ⚡ **High Performance**: Optimized for Node.js environments

## Installation

```bash
npm install @re-auth/http-adapters express
# or
pnpm add @re-auth/http-adapters express
# or
yarn add @re-auth/http-adapters express
```

## Quick Start

### Basic Setup

```typescript
import express from 'express'
import { expressReAuth } from '@re-auth/http-adapters'

const app = express()

// Create adapter with device info extraction
const adapter = expressReAuth({
  engine: reAuthEngine,
  basePath: '/api/auth'
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

// Apply middleware
app.use(express.json())
app.use(adapter.createMiddleware())

// Mount routes
app.use('/api/auth', adapter.createRouter())

// Optional: Add user population middleware
app.use(adapter.createUserMiddleware())

app.listen(3000, () => {
  console.log('Server running on port 3000')
})
```

### Advanced Configuration

```typescript
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { expressReAuth } from '@re-auth/http-adapters'

const app = express()

const adapter = expressReAuth({
  engine: reAuthEngine,
  basePath: '/auth',
  cors: {
    origin: ['https://app.example.com'],
    credentials: true
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  },
  security: {
    helmet: true,
    csrf: false
  }
})

// Security middleware
app.use(helmet())
app.use(cors())
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }))

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ReAuth middleware and routes
app.use(adapter.createMiddleware())
app.use('/auth', adapter.createRouter())
app.use(adapter.createUserMiddleware())

// Custom routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default app
```

## API Reference

### `expressReAuth(config)`

Factory function to create an ExpressAdapter instance.

```typescript
const adapter = expressReAuth({
  engine: reAuthEngine,
  basePath: '/api/auth',
  cors: { origin: true },
  rateLimit: { windowMs: 15 * 60 * 1000, max: 100 }
})
```

### `adapter.createMiddleware()`

Creates Express middleware for request processing, security, and validation.

```typescript
app.use(adapter.createMiddleware())
```

### `adapter.createRouter()`

Creates an Express router with all ReAuth routes mounted.

```typescript
const authRouter = adapter.createRouter()
app.use('/api/auth', authRouter)
```

### `adapter.createUserMiddleware()`

Creates middleware that populates `req.user` and `req.authenticated`.

```typescript
app.use(adapter.createUserMiddleware())
```

### `adapter.getCurrentUser(req)`

Manually retrieve the current user from an Express request.

```typescript
app.get('/profile', async (req, res) => {
  const user = await adapter.getCurrentUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  res.json({ user: user.subject })
})
```

### Device Info Extraction

Extract custom device information from requests for enhanced security and analytics:

```typescript
const adapter = createExpressAdapter(config, false, async (req) => {
  // Extract device information from Express request
  return {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    fingerprint: req.get('X-Request-ID'),
    geoLocation: req.get('CF-IPCountry'),
    deviceType: req.get('CF-Device-Type'),
    sessionId: req.session?.id,
  };
});
```

## Usage Examples

### Complete Express Application

```typescript
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import { expressReAuth } from '@re-auth/http-adapters'

const app = express()

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"]
    }
  }
}))

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://myapp.com']
    : true,
  credentials: true
}))

// Logging
app.use(morgan('combined'))

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ReAuth setup
const adapter = expressReAuth({
  engine: reAuthEngine,
  basePath: '/api/auth',
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || true,
    credentials: true
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
  },
  security: {
    helmet: true,
    csrf: false,
    sanitizeInput: true
  }
}, false, async (req) => {
  // Comprehensive device info extraction
  return {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    fingerprint: req.get('X-Request-ID'),
    geoLocation: req.get('CF-IPCountry'),
    deviceType: req.get('CF-Device-Type'),
    sessionId: req.session?.id,
    browserFingerprint: req.get('X-Browser-Fingerprint'),
    timezone: req.get('X-Timezone'),
    language: req.get('Accept-Language'),
    platform: req.get('Sec-Ch-Ua-Platform'),
  };
});

// Apply ReAuth middleware
app.use(adapter.createMiddleware())

// Mount ReAuth routes
app.use('/api/auth', adapter.createRouter())

// User population middleware
app.use(adapter.createUserMiddleware())

// API routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version
  })
})

app.get('/api/profile', async (req, res) => {
  const user = req.user
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  res.json({
    user: user.subject,
    sessionValid: user.valid,
    lastLogin: user.metadata?.lastAccessed
  })
})

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    error: 'Internal Server Error',
    timestamp: new Date().toISOString()
  })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

export default app
```

### Microservices Architecture

```typescript
import express from 'express'
import { expressReAuth } from '@re-auth/http-adapters'

const app = express()

// Auth service
const authAdapter = expressReAuth({
  engine: reAuthEngine,
  basePath: '/auth'
}, false, async (req) => ({
  ip: req.ip,
  userAgent: req.get('User-Agent'),
  service: 'auth-service',
}));

// API service
const apiAdapter = expressReAuth({
  engine: apiEngine,
  basePath: '/api'
}, false, async (req) => ({
  ip: req.ip,
  userAgent: req.get('User-Agent'),
  service: 'api-service',
}));

// Mount services
app.use('/auth', authAdapter.createRouter())
app.use('/api', apiAdapter.createRouter())

// Cross-service communication
app.use('/internal/auth-check', async (req, res) => {
  const user = await authAdapter.getCurrentUser(req)
  res.json({ authenticated: !!user, user: user?.subject })
})

export default app
```

### Testing with Supertest

```typescript
import request from 'supertest'
import { expressReAuth } from '@re-auth/http-adapters'

const adapter = expressReAuth({ engine: reAuthEngine })
const app = express()
app.use('/auth', adapter.createRouter())

describe('Authentication', () => {
  it('should login user', async () => {
    const response = await request(app)
      .post('/auth/email-password/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      })
      .expect(200)

    expect(response.body.success).toBe(true)
    expect(response.body.data.token).toBeDefined()
  })

  it('should check session', async () => {
    const loginResponse = await request(app)
      .post('/auth/email-password/login')
      .send({ email: 'test@example.com', password: 'password123' })

    const token = loginResponse.body.data.token

    const sessionResponse = await request(app)
      .get('/auth/session')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(sessionResponse.body.success).toBe(true)
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

Full TypeScript support with Express types:

```typescript
import express, { Request, Response, NextFunction } from 'express'
import { expressReAuth } from '@re-auth/http-adapters'

// Type-safe route handlers
app.get('/profile', async (req: Request, res: Response) => {
  const user = req.user // Properly typed AuthenticatedUser | undefined
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  res.json({ user: user.subject })
})

// Custom middleware with proper typing
const customAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = await adapter.getCurrentUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  req.user = user
  next()
}
```

## Best Practices

### 1. Middleware Ordering

```typescript
// Correct order is crucial
app.use(cors())           // 1. CORS headers
app.use(helmet())         // 2. Security headers
app.use(morgan('combined')) // 3. Logging
app.use(express.json())   // 4. Body parsing
app.use(adapter.createMiddleware()) // 5. ReAuth processing
app.use('/auth', adapter.createRouter()) // 6. Route mounting
app.use(adapter.createUserMiddleware()) // 7. User population
```

### 2. Error Handling

```typescript
// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack)

  // ReAuth-specific errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: err.message }
    })
  }

  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' }
  })
})
```

### 3. Security Configuration

```typescript
const adapter = expressReAuth({
  engine: reAuthEngine,
  security: {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"]
        }
      }
    },
    csrf: process.env.NODE_ENV === 'production',
    sanitizeInput: true
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
    keyGenerator: (req) => req.ip || req.connection.remoteAddress || 'unknown'
  }
})
```

## Performance Considerations

- **Middleware Efficiency**: Order middleware to fail fast
- **Rate Limiting**: Use Redis store for distributed rate limiting
- **Caching**: Cache CORS preflight responses
- **Compression**: Use compression middleware for responses
- **Clustering**: Use Node.js clustering for multi-core utilization

## Troubleshooting

### Common Issues

**Middleware Not Applied**
```typescript
// Routes must be mounted after middleware
app.use(cors())
app.use(express.json())
app.use('/auth', adapter.createRouter()) // ✅ Correct
```

**User Not Populated**
```typescript
// User middleware must be applied after route mounting
app.use('/auth', adapter.createRouter())
app.use(adapter.createUserMiddleware()) // ✅ After routes
```

**CORS Errors**
```typescript
// CORS must be configured before routes
app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true
}))
app.use('/auth', adapter.createRouter())
```

**Rate Limiting Not Working**
```typescript
// Rate limiting should be early in middleware stack
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.ip // Ensure proper key generation
}))
```

## License

MIT
