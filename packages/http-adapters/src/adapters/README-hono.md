# Hono Adapter

> **Framework**: [Hono](https://hono.dev) - Web framework optimized for Cloudflare Workers
> **Status**: ✅ Production Ready

The Hono adapter provides seamless integration between ReAuth and Hono, optimized for edge runtimes, serverless environments, and modern web platforms.

## Features

- ☁️ **Edge Optimized**: Designed for Cloudflare Workers, Deno, and edge runtimes
- 🌐 **Multi-Platform**: Works with Cloudflare Workers, Fastly, Deno, Bun, Vercel, Netlify
- 🛡️ **Web Standard APIs**: Built on Web Standards (Request, Response, fetch)
- 🚀 **Lightweight**: Minimal bundle size for edge deployments
- 🔧 **Middleware First**: Hono's powerful middleware system
- 📦 **Type Safe**: Full TypeScript support with Hono's type system
- ⚡ **Fast**: Optimized for low-latency edge environments
- 🔄 **Framework Agnostic**: Can be used with any Hono-compatible runtime

## Installation

```bash
npm install @re-auth/http-adapters hono
# or
pnpm add @re-auth/http-adapters hono
# or
yarn add @re-auth/http-adapters hono
```

## Quick Start

### Cloudflare Worker

```typescript
import { Hono } from 'hono'
import { honoReAuth } from '@re-auth/http-adapters'

const app = new Hono()

// Create adapter with device info extraction
const adapter = honoReAuth({
  engine: reAuthEngine,
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
    datacenter: c.req.header('cf-ray')?.split('-')[0],
  };
});

// Register routes
adapter.registerRoutes(app)

// Add custom routes
app.get('/health', (c) => c.json({ status: 'ok' }))

export default app
```

### Deno/Edge Runtime

```typescript
import { Hono } from 'https://deno.land/x/hono/mod.ts'
import { honoReAuth } from 'https://esm.sh/@re-auth/http-adapters'

const app = new Hono()

const adapter = honoReAuth({
  engine: reAuthEngine,
  basePath: '/auth'
})

adapter.registerRoutes(app)

app.get('/api/health', (c) => c.json({
  status: 'ok',
  timestamp: new Date().toISOString()
}))

Deno.serve(app.fetch)
```

### Advanced Setup

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { honoReAuth } from '@re-auth/http-adapters'

const app = new Hono()

// Global middleware
app.use('*', cors({
  origin: ['https://app.example.com'],
  credentials: true
}))

app.use('*', logger())

// ReAuth setup
const adapter = honoReAuth({
  engine: reAuthEngine,
  basePath: '/api/auth',
  cors: {
    origin: ['https://app.example.com', 'https://admin.example.com'],
    credentials: true
  }
})

// Register ReAuth routes
adapter.registerRoutes(app, '/api/auth')

// User middleware (optional)
app.use('*', adapter.createUserMiddleware())

// Custom routes
app.get('/api/profile', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  return c.json({ user: user.subject })
})

// Error handling
app.onError((err, c) => {
  console.error(`${err}`)
  return c.json({ error: 'Internal Server Error' }, 500)
})

export default app
```

## API Reference

### `honoReAuth(config)`

Factory function to create a HonoAdapter instance.

```typescript
const adapter = honoReAuth({
  engine: reAuthEngine,
  basePath: '/api/auth',
  cors: { origin: true }
})
```

### `adapter.registerRoutes(hono, basePath?, exposeIntrospection?)`

Registers ReAuth routes on a Hono app instance.

```typescript
const app = new Hono()
adapter.registerRoutes(app, '/auth', true)
```

### `adapter.createUserMiddleware()`

Creates Hono middleware that populates user context.

```typescript
app.use('*', adapter.createUserMiddleware())
```

### `adapter.getCurrentUser(c)`

Manually retrieve the current user from a Hono context.

```typescript
app.get('/profile', async (c) => {
  const user = await adapter.getCurrentUser(c)
  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401)
  }
  return c.json({ user: user.subject })
})
```

### Device Info Extraction

Device information extraction is a core security feature of Hono adapter, optimized for edge environments and Cloudflare Workers.

### Cloudflare Workers Example

```typescript
const adapter = honoReAuth(config, async (c) => {
  // Extract Cloudflare-specific device information
  return {
    ip: c.env?.CF_CONNECTING_IP || c.req.header('x-forwarded-for'),
    userAgent: c.req.header('user-agent'),
    fingerprint: c.req.header('cf-ray'),
    country: c.req.header('cf-ipcountry'),
    deviceType: c.req.header('cf-device-type'),
    timezone: c.req.header('cf-timezone'),
    datacenter: c.req.header('cf-ray')?.split('-')[0],
    tlsVersion: c.req.header('cf-visitor'),
    botScore: c.req.header('cf-bot-score'),
  };
});
```

### Deno/Node.js Example

```typescript
const adapter = honoReAuth(config, async (c) => {
  // Extract standard web device information
  return {
    ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
    userAgent: c.req.header('user-agent'),
    fingerprint: c.req.header('x-request-id'),
    language: c.req.header('accept-language'),
    platform: c.req.header('sec-ch-ua-platform'),
    mobile: c.req.header('sec-ch-ua-mobile') === '?1',
  };
});
```

### Advanced Device Analysis

```typescript
const deviceInfoExtractor = async (c: Context) => {
  const basicInfo = {
    ip: c.env?.CF_CONNECTING_IP || c.req.header('x-forwarded-for'),
    userAgent: c.req.header('user-agent'),
    fingerprint: c.req.header('cf-ray'),
  };

  // Async enrichment (database lookup, external API, etc.)
  const geoData = await lookupGeoLocation(basicInfo.ip);
  const riskScore = await calculateRiskScore(basicInfo);

  return {
    ...basicInfo,
    ...geoData,
    riskScore,
    trustLevel: riskScore < 0.3 ? 'high' : riskScore < 0.7 ? 'medium' : 'low',
    flagged: riskScore > 0.8,
    lastSeen: new Date().toISOString(),
  };
};

const adapter = honoReAuth(config, deviceInfoExtractor);
```

## Configuration Options

### Complete Hono Application

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { jwt } from 'hono/jwt'
import { honoReAuth } from '@re-auth/http-adapters'

const app = new Hono()

// Global middleware
app.use('*', logger())
app.use('*', cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://myapp.com']
    : true,
  credentials: true
}))

// Health check
app.get('/health', (c) => c.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development'
}))

// ReAuth setup
const adapter = honoReAuth({
  engine: reAuthEngine,
  basePath: '/api/auth',
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || true,
    credentials: true
  }
}, async (c) => {
  // Advanced device info extraction for Hono
  return {
    ip: c.env?.CF_CONNECTING_IP || c.req.header('x-forwarded-for'),
    userAgent: c.req.header('user-agent'),
    fingerprint: c.req.header('cf-ray'),
    country: c.req.header('cf-ipcountry'),
    deviceType: c.req.header('cf-device-type'),
    timezone: c.req.header('cf-timezone'),
    datacenter: c.req.header('cf-ray')?.split('-')[0],
    tlsVersion: c.req.header('cf-visitor'),
    botScore: c.req.header('cf-bot-score'),
    // Additional Cloudflare metadata
    colo: c.req.header('cf-ray')?.substring(0, 3),
    httpProtocol: c.req.header('x-forwarded-proto'),
  };
});

// Register ReAuth routes
adapter.registerRoutes(app)

// User population middleware
app.use('*', adapter.createUserMiddleware())

// API routes
app.get('/api/profile', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  return c.json({
    user: user.subject,
    sessionValid: user.valid,
    lastLogin: user.metadata?.lastAccessed
  })
})

// Admin routes with role check
app.get('/api/admin/users', async (c) => {
  const user = c.get('user')
  if (!user || user.subject.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  return c.json({ users: [] })
})

// File upload example
app.post('/api/upload', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  const body = await c.req.parseBody()
  const file = body['file'] as File

  // Process file upload
  return c.json({ success: true, fileName: file.name })
})

// Error handling
app.onError((err, c) => {
  console.error(`${err}`)
  return c.json({
    error: 'Internal Server Error',
    timestamp: new Date().toISOString()
  }, 500)
})

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})

export default app
```

### Middleware Composition

```typescript
import { Hono } from 'hono'
import { honoReAuth } from '@re-auth/http-adapters'

// Custom middleware
const authRequired = async (c, next) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  await next()
}

const adminRequired = async (c, next) => {
  const user = c.get('user')
  if (!user || user.subject.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }
  await next()
}

const app = new Hono()

// ReAuth setup
const adapter = honoReAuth({ engine: reAuthEngine })
adapter.registerRoutes(app)
app.use('*', adapter.createUserMiddleware())

// Routes with different auth levels
app.get('/api/public', (c) => c.json({ message: 'Public route' }))

app.get('/api/profile', authRequired, async (c) => {
  const user = c.get('user')
  return c.json({ user: user.subject })
})

app.get('/api/admin', authRequired, adminRequired, async (c) => {
  return c.json({ message: 'Admin access granted' })
})

export default app
```

### Cloudflare Worker with Durable Objects

```typescript
import { Hono } from 'hono'
import { honoReAuth } from '@re-auth/http-adapters'

export class AuthDurableObject {
  state: DurableObjectState

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const app = new Hono()

    const adapter = honoReAuth({
      engine: reAuthEngine,
      basePath: '/auth'
    }, async (c) => ({
      ip: c.env?.CF_CONNECTING_IP || c.req.header('x-forwarded-for'),
      userAgent: c.req.header('user-agent'),
      fingerprint: c.req.header('cf-ray'),
      country: c.req.header('cf-ipcountry'),
      deviceType: c.req.header('cf-device-type'),
      datacenter: c.req.header('cf-ray')?.split('-')[0],
      durableObjectId: 'session123',
    }));

    adapter.registerRoutes(app)
    app.use('*', adapter.createUserMiddleware())

    app.get('/session', async (c) => {
      const user = c.get('user')
      const sessionId = c.req.header('X-Session-ID')

      // Store session in Durable Object
      await this.state.storage.put(`session:${sessionId}`, {
        user: user?.subject,
        lastAccess: Date.now()
      })

      return c.json({ user: user?.subject })
    })

    return app.fetch(request)
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const sessionId = url.searchParams.get('session')

    const id = env.AUTH_DURABLE_OBJECT.idFromName(sessionId || 'default')
    const stub = env.AUTH_DURABLE_OBJECT.get(id)

    return stub.fetch(request)
  }
}
```

### Testing with Hono

```typescript
import { testClient } from 'hono/testing'
import app from './app.js'

describe('Authentication', () => {
  const client = testClient(app)

  it('should login user', async () => {
    const res = await client.api.auth['email-password'].login.$post({
      json: {
        email: 'test@example.com',
        password: 'password123'
      }
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.data.token).toBeDefined()
  })

  it('should access protected route', async () => {
    const loginRes = await client.api.auth['email-password'].login.$post({
      json: { email: 'test@example.com', password: 'password123' }
    })
    const loginData = await loginRes.json()
    const token = loginData.data.token

    const profileRes = await client.api.profile.$get({}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    expect(profileRes.status).toBe(200)
    const profile = await profileRes.json()
    expect(profile.user).toBeDefined()
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

Full TypeScript support with Hono's type system:

```typescript
import { Hono } from 'hono'
import { honoReAuth } from '@re-auth/http-adapters'

type Variables = {
  user: AuthenticatedUser
}

const app = new Hono<{ Variables: Variables }>()

const adapter = honoReAuth({ engine: reAuthEngine })

// Type-safe route handlers
app.get('/profile', async (c) => {
  const user = c.get('user') // Properly typed AuthenticatedUser
  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401)
  }
  return c.json({ user: user.subject })
})

// Type-safe middleware
const authMiddleware = async (c, next) => {
  const user = await adapter.getCurrentUser(c)
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  c.set('user', user) // Type-safe variable setting
  await next()
}

app.use('/protected/*', authMiddleware)
```

## Best Practices

### 1. Middleware Ordering

```typescript
// Correct order is crucial for Hono
app.use('*', cors())           // 1. CORS headers
app.use('*', logger())         // 2. Logging
app.use('*', adapter.createUserMiddleware()) // 3. User population
adapter.registerRoutes(app)    // 4. Route registration
```

### 2. Context Variables

```typescript
// Use Hono's context variables for type safety
type Variables = {
  user: AuthenticatedUser
  sessionId: string
}

const app = new Hono<{ Variables: Variables }>()

app.use('*', async (c, next) => {
  const user = await adapter.getCurrentUser(c)
  if (user) {
    c.set('user', user)
    c.set('sessionId', 'session123')
  }
  await next()
})

// Now user and sessionId are type-safe
app.get('/profile', (c) => {
  const user = c.get('user')        // AuthenticatedUser
  const sessionId = c.get('sessionId') // string
  return c.json({ user, sessionId })
})
```

### 3. Error Handling

```typescript
app.onError((err, c) => {
  console.error(`${err}`)

  if (err.message.includes('Validation')) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: err.message }
    }, 400)
  }

  return c.json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' }
  }, 500)
})

// Async error handling
app.use('*', async (c, next) => {
  try {
    await next()
  } catch (err) {
    console.error('Async error:', err)
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})
```

### 4. Performance Optimization

```typescript
// Use Hono's built-in optimizations
const app = new Hono()

// Enable compression
app.use('*', async (c, next) => {
  await next()
  c.header('Content-Encoding', 'gzip')
})

// Cache static responses
const cache = new Map()
app.get('/health', (c) => {
  const cached = cache.get('health')
  if (cached && Date.now() - cached.timestamp < 30000) { // 30s cache
    return c.json(cached.data)
  }
  const data = { status: 'ok', timestamp: new Date().toISOString() }
  cache.set('health', { data, timestamp: Date.now() })
  return c.json(data)
})
```

## Performance Considerations

- **Edge Optimized**: Designed for low-latency edge environments
- **Minimal Bundle Size**: Only includes necessary Hono utilities
- **Web Standards**: Uses native Request/Response APIs
- **Streaming**: Support for streaming responses
- **Middleware Efficiency**: Hono's middleware system is highly optimized

## Troubleshooting

### Common Issues

**Middleware Not Applied**
```typescript
// Routes must be registered after middleware
app.use('*', cors())
adapter.registerRoutes(app) // ✅ After middleware
```

**User Context Not Available**
```typescript
// User middleware must be applied before routes that need user
app.use('*', adapter.createUserMiddleware())
adapter.registerRoutes(app) // ✅ After user middleware
```

**CORS Errors**
```typescript
// CORS middleware must be applied first
app.use('*', cors({
  origin: true, // Allow all origins for development
  credentials: true
}))
adapter.registerRoutes(app)
```

**Type Errors**
```typescript
// Define proper Hono types
type Variables = {
  user: AuthenticatedUser
}

const app = new Hono<{ Variables: Variables }>()
// Now c.get('user') returns AuthenticatedUser
```

**Route Conflicts**
```typescript
// Avoid route conflicts by using different base paths
const adapter1 = honoReAuth({ engine: engine1, basePath: '/auth' })
const adapter2 = honoReAuth({ engine: engine2, basePath: '/admin/auth' })

adapter1.registerRoutes(app) // /auth/*
adapter2.registerRoutes(app) // /admin/auth/*
```

## Deployment Examples

### Cloudflare Workers

```typescript
import app from './src/app'

export default {
  fetch: app.fetch
}
```

### Vercel Edge Functions

```typescript
import app from './src/app'

export default function handler(request) {
  return app.fetch(request)
}

export const config = {
  runtime: 'edge'
}
```

### Deno Deploy

```typescript
import app from './src/app.ts'

Deno.serve(app.fetch)
```

### Netlify Functions

```typescript
import app from './src/app.ts'

export async function handler(event) {
  const request = new Request(event.rawUrl, {
    method: event.httpMethod,
    headers: event.headers,
    body: event.body
  })

  const response = await app.fetch(request)
  const responseBody = await response.text()

  return {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers),
    body: responseBody
  }
}
```

## License

MIT
