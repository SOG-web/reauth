# IttyRouter Adapter

> **Framework**: [itty-router](https://itty.dev/itty-router) - Cloudflare Workers & Edge Runtime
> **Status**: ✅ Production Ready

The IttyRouter adapter provides seamless integration between ReAuth and [itty-router](https://itty.dev/itty-router), optimized for Cloudflare Workers, edge runtimes, and serverless environments.

## Features

- 🚀 **Edge Optimized**: Designed for Cloudflare Workers and edge environments
- 🔒 **CORS Support**: Built-in CORS configuration with customizable options
- 🛠️ **Middleware Support**: Register custom middleware for authentication, logging, etc.
- 🏗️ **Auto Router Creation**: Optional automatic router creation or use existing routers
- 📦 **Type Safe**: Full TypeScript support with itty-router's `IRequest` types
- ⚡ **Lightweight**: Minimal overhead for edge deployments

## Installation

```bash
npm install @re-auth/http-adapters itty-router
# or
pnpm add @re-auth/http-adapters itty-router
# or
yarn add @re-auth/http-adapters itty-router
```

## Quick Start

### Basic Usage

```typescript
import { AutoRouter } from 'itty-router'
import { reAuthRouter, createReAuthRouter } from '@re-auth/http-adapters'

const config = {
  engine: reAuthEngine,
  basePath: '/api/auth',
  cors: {
    origin: ['https://app.example.com'],
    credentials: true
  }
}

// Method 1: Create adapter instance with device info extraction
const adapter = reAuthRouter(config, async (request) => {
  // Extract device information for enhanced security
  return {
    ip: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For'),
    userAgent: request.headers.get('User-Agent'),
    fingerprint: request.headers.get('CF-Ray'),
    country: request.headers.get('CF-IPCountry'),
    deviceType: request.headers.get('CF-Device-Type'),
    datacenter: request.headers.get('CF-Ray')?.split('-')[0],
  };
});

const router = AutoRouter()
adapter.configureCORS(router)
adapter.registerRoutes(router)

// Method 2: Create router with adapter and device info extraction
const { router, adapter } = createReAuthRouter(
  {
    basePath: '/api/auth',
    exposeIntrospection: true,
    corsOptions: { origin: true }
  },
  config,
  async (request) => ({
    ip: request.headers.get('CF-Connecting-IP'),
    userAgent: request.headers.get('User-Agent'),
    fingerprint: request.headers.get('CF-Ray'),
  })
)

export default router
```

### Advanced Setup

```typescript
import { AutoRouter } from 'itty-router'
import { reAuthRouter } from '@re-auth/http-adapters'

const adapter = reAuthRouter({
  engine: reAuthEngine,
  basePath: '/auth',
  cors: {
    origin: ['https://app.example.com', 'https://admin.example.com'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  }
}, async (request) => {
  // Advanced device info extraction
  return {
    ip: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For'),
    userAgent: request.headers.get('User-Agent'),
    fingerprint: request.headers.get('CF-Ray'),
    country: request.headers.get('CF-IPCountry'),
    deviceType: request.headers.get('CF-Device-Type'),
    timezone: request.headers.get('CF-Timezone'),
    datacenter: request.headers.get('CF-Ray')?.split('-')[0],
    // Additional security metadata
    tlsVersion: request.headers.get('CF-Visitor'),
    botScore: request.headers.get('CF-Bot-Score'),
  };
});

const router = AutoRouter()

// Configure CORS
adapter.configureCORS(router, {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
})

// Register custom middleware
adapter.registerMiddleware(router, {
  before: [
    // Custom auth middleware
    async (request) => {
      console.log('Request:', request.url)
    },
    // Rate limiting
    async (request) => {
      // Implement rate limiting logic
    }
  ],
  finally: [
    // Response logging
    async (response) => {
      console.log('Response sent')
    }
  ]
})

// Register ReAuth routes
adapter.registerRoutes(router)

// Add custom routes
router.get('/health', () => ({ status: 'ok' }))

export default router
```

## API Reference

### `reAuthRouter(config)`

Factory function to create an IttyRouterAdapter instance.

```typescript
const adapter = reAuthRouter({
  engine: reAuthEngine,
  basePath: '/api/auth',
  cors: { origin: true }
})
```

### `createReAuthRouter(routerConfig, config)`

Creates both a router and adapter in one call.

```typescript
const { router, adapter } = createReAuthRouter(
  {
    basePath: '/api/auth',
    exposeIntrospection: true,
    corsOptions: { origin: true }
  },
  { engine: reAuthEngine }
)
```

### `adapter.createRouter(basePath?, exposeIntrospection?, corsOptions?)`

Creates a fully configured AutoRouter with CORS and routes.

```typescript
const router = adapter.createRouter('/api/auth', true, {
  origin: 'https://app.example.com',
  credentials: true
})
```

### `adapter.registerRoutes(router?, basePath?, exposeIntrospection?)`

Registers ReAuth routes on an existing router or creates a new one.

```typescript
// Use existing router
adapter.registerRoutes(existingRouter)

// Create new router
const newRouter = adapter.registerRoutes()
```

### `adapter.configureCORS(router, options?)`

Configures CORS on an existing router.

```typescript
adapter.configureCORS(router, {
  origin: ['https://app.example.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
})
```

### `adapter.registerMiddleware(router, middleware)`

Adds custom middleware to a router.

```typescript
adapter.registerMiddleware(router, {
  before: [middleware1, middleware2], // Before route matching
  finally: [middleware3] // After route handling
})
```

### `adapter.createUserMiddleware()`

Creates middleware that populates `request.user` and `request.authenticated`.

```typescript
const userMiddleware = adapter.createUserMiddleware()

// Add to router
router.before.unshift(userMiddleware)
```

### `adapter.getCurrentUser(request)`

Manually retrieve the current user from a request.

```typescript
router.get('/profile', async (request) => {
  const user = await adapter.getCurrentUser(request)
  if (!user) {
    return error(401, { error: 'Not authenticated' })
  }
  return { user: user.subject }
})
```

### Device Info Extraction

Extract custom device information from requests for enhanced security and analytics:

```typescript
const adapter = reAuthRouter(config, async (request) => {
  // Extract device information from itty-router request
  return {
    ip: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For'),
    userAgent: request.headers.get('User-Agent'),
    fingerprint: request.headers.get('CF-Ray'),
    country: request.headers.get('CF-IPCountry'),
    deviceType: request.headers.get('CF-Device-Type'),
  };
});
```

## Configuration Options

```typescript
interface CorsOptions {
  origin?: string | string[] | boolean | ((origin: string) => boolean)
  credentials?: boolean
  allowedHeaders?: string[]
  methods?: string[]
  maxAge?: number
}
```

### Middleware Configuration

```typescript
interface MiddlewareConfig {
  before?: RequestHandler[]  // Middleware before route matching
  finally?: ResponseHandler[] // Middleware after route handling
}
```

## Usage Examples

### Basic Authentication Flow

```typescript
import { AutoRouter } from 'itty-router'
import { createReAuthRouter } from '@re-auth/http-adapters'

const { router, adapter } = createReAuthRouter(
  {
    basePath: '/auth',
    exposeIntrospection: false,
    corsOptions: { origin: true, credentials: true }
  },
  { engine: reAuthEngine }
)

// Add user middleware
router.before.unshift(adapter.createUserMiddleware())

// Protected route
router.get('/profile', (request) => {
  const user = request.user
  if (!user) {
    return error(401, { error: 'Authentication required' })
  }
  return { user: user.subject }
})

export default router
```

### Custom Middleware Integration

```typescript
import { AutoRouter } from 'itty-router'
import { reAuthRouter } from '@re-auth/http-adapters'

const adapter = reAuthRouter({ engine: reAuthEngine })
const router = AutoRouter()

// Logging middleware
const loggingMiddleware = async (request) => {
  console.log(`${request.method} ${request.url}`)
}

// Rate limiting middleware
const rateLimitMiddleware = async (request) => {
  // Implement rate limiting logic
  // Return early if rate limited
}

// Error handling middleware
const errorMiddleware = async (response) => {
  if (response.status >= 400) {
    console.error('Error response:', response)
  }
}

// Register middleware
adapter.registerMiddleware(router, {
  before: [loggingMiddleware, rateLimitMiddleware],
  finally: [errorMiddleware]
})

// Configure CORS and routes
adapter.configureCORS(router, { origin: true })
adapter.registerRoutes(router)

export default router
```

### Cloudflare Worker Deployment

```typescript
import { createReAuthRouter } from '@re-auth/http-adapters'

const { router } = createReAuthRouter(
  {
    basePath: '/api/auth',
    exposeIntrospection: false,
    corsOptions: {
      origin: ['https://myapp.com'],
      credentials: true
    }
  },
  { engine: reAuthEngine },
  async (request) => ({
    ip: request.headers.get('CF-Connecting-IP'),
    userAgent: request.headers.get('User-Agent'),
    fingerprint: request.headers.get('CF-Ray'),
    country: request.headers.get('CF-IPCountry'),
    deviceType: request.headers.get('CF-Device-Type'),
    tlsVersion: request.headers.get('CF-Visitor'),
  })
)

export default {
  fetch: router.fetch
}
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

The adapter provides full TypeScript support:

```typescript
import type { AuthenticatedUser, IRequest } from '@re-auth/http-adapters'

// Type-safe request handlers
router.get('/profile', async (request: IRequest): Promise<Response> => {
  const user: AuthenticatedUser | null = await adapter.getCurrentUser(request)
  return user ? json({ user: user.subject }) : error(401)
})

// Custom middleware with proper typing
const authMiddleware = async (request: IRequest): Promise<void> => {
  const user = await adapter.getCurrentUser(request)
  if (!user) {
    throw error(401, { error: 'Not authenticated' })
  }
  request.user = user
}
```

## Best Practices

### 1. CORS Configuration
```typescript
// For production, specify allowed origins explicitly
adapter.configureCORS(router, {
  origin: ['https://yourapp.com', 'https://admin.yourapp.com'],
  credentials: true
})

// For development
adapter.configureCORS(router, { origin: true })
```

### 2. Middleware Ordering
```typescript
// Order matters! Add middleware in the correct sequence
adapter.registerMiddleware(router, {
  before: [
    corsMiddleware,     // Must be first for preflight requests
    loggingMiddleware,
    authMiddleware,
    rateLimitMiddleware
  ],
  finally: [
    responseMiddleware,
    errorMiddleware
  ]
})
```

### 3. Error Handling
```typescript
router.finally.push(async (response) => {
  if (response.status >= 500) {
    // Log server errors
    console.error('Server error:', response)
  }
})
```

## Migration from Other Adapters

### From Express/Fastify
```typescript
// Before
import { createExpressAdapter } from '@re-auth/http-adapters'
const adapter = createExpressAdapter({ engine })

// After
import { reAuthRouter } from '@re-auth/http-adapters'
const adapter = reAuthRouter({ engine })
const router = adapter.createRouter('/auth', true, { origin: true })
```

### Key Differences
- **Router Creation**: itty-router requires explicit router creation
- **Middleware**: Uses `before` and `finally` arrays instead of `use()`
- **Response Format**: Uses `json()` and `error()` helpers instead of `res.json()`
- **Async Handlers**: All handlers are async by default

## Performance Considerations

- **Edge Optimized**: Designed for low-latency edge environments
- **Minimal Bundle Size**: Only includes necessary itty-router utilities
- **Efficient Middleware**: `before`/`finally` arrays provide optimal execution order
- **Type Safety**: Compile-time checks prevent runtime errors

## Troubleshooting

### Common Issues

**CORS Errors**
```typescript
// Ensure CORS is configured before routes
adapter.configureCORS(router, { origin: true })
adapter.registerRoutes(router)
```

**Middleware Not Executing**
```typescript
// Add middleware before routes
router.before.unshift(authMiddleware)
adapter.registerRoutes(router)
```

**Type Errors**
```typescript
// Use IRequest type for full type safety
router.get('/protected', async (request: IRequest) => {
  // request.params, request.query, etc. are properly typed
})
```

## License

MIT
