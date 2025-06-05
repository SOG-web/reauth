# Express Adapter V2

The Express Adapter V2 is a completely rewritten version of the Express HTTP adapter that follows a factory pattern and provides better framework-agnostic design with powerful context management features.

## Key Improvements over V1

### 🏗️ **Factory Pattern Architecture**
- **Framework-agnostic design**: Core logic separated from Express-specific implementations
- **Shared instances**: Memory-efficient shared framework adapter instances
- **Consistent interface**: All framework adapters implement the same `FrameworkAdapter<T>` interface

### 🎯 **Plugin-Aware Status Codes**
- **Respects plugin HTTP configs**: Automatically uses status codes defined in ReAuth plugins
- **Proper fallback hierarchy**: Plugin codes → generic success/error → standard HTTP codes
- **Custom status handling**: Supports plugin-specific status codes like `unf: 401`, `ip: 400`, `eq: 300`

### 🔧 **Configurable Context Management**
- **Cookie/header extraction**: Automatically extract values from requests based on rules
- **Response context setting**: Set cookies and headers in responses based on plugin outputs
- **OAuth2 context rules**: Built-in support for OAuth flows with state management
- **Transform functions**: Custom input/output transformations

### 🛡️ **True Framework Agnostic**
- **No framework assumptions**: Factory doesn't make Express-specific calls
- **Reusable utilities**: Shared context rules and helper functions
- **Easy extensibility**: Add new frameworks by implementing the interface

## Quick Start

```typescript
import { createExpressAdapter, createContextRule } from '@re-auth/http-adapters';
import { reAuthEngine } from './auth';

// Basic usage
const adapter = createExpressAdapter(reAuthEngine, {
  basePath: '/auth',
  cookieName: 'session_token',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
});

const app = express();
app.use('/auth', adapter.getRouter());
```

## Advanced Configuration

### Context Rules for OAuth

```typescript
import { OAuth2ContextRules, createContextRule } from '@re-auth/http-adapters';

const adapter = createExpressAdapter(reAuthEngine, {
  basePath: '/auth',
  contextRules: [
    // OAuth state and redirect handling
    ...OAuth2ContextRules.github('oauth-github'),
    ...OAuth2ContextRules.google('oauth-google'),
    
    // Custom API key handling
    createContextRule('api-auth', {
      stepName: 'verify-key',
      extractHeaders: ['x-api-key'],
      extractCookies: ['refresh_token'],
      setCookies: ['new_refresh_token'],
      transformInput: (key, value, request) => {
        if (key === 'x-api-key') {
          return value.startsWith('ak_') ? value : null;
        }
        return value;
      },
    }),
  ],
});
```

### Auto-Introspection & Route Generation

```typescript
const adapter = createExpressAdapter(reAuthEngine, {
  autoIntrospection: {
    enabled: true,
    includePlugins: ['email-password', 'oauth-google'],
    excludeSteps: ['admin.ban-user'],
    pathGenerator: (pluginName, stepName, basePath) => {
      if (pluginName.startsWith('oauth-')) {
        const provider = pluginName.replace('oauth-', '');
        return `${basePath}/oauth/${provider}/${stepName}`;
      }
      return `${basePath}/${pluginName}/${stepName}`;
    },
  },
});
```

### Route Overrides & Custom Routes

```typescript
import { createRouteOverride, createCustomRoute } from '@re-auth/http-adapters';

const adapter = createExpressAdapter(reAuthEngine, {
  routeOverrides: [
    createRouteOverride('email-password', 'register', {
      middleware: [rateLimitingMiddleware],
      extractInputs: async (req, pluginName, stepName) => {
        // Custom input extraction logic
        return { ...await defaultExtraction(req), customField: req.body.custom };
      },
    }),
  ],
  
  customRoutes: [
    createCustomRoute('GET', '/auth/status', (req, res) => {
      res.json({
        authenticated: req.isAuthenticated(),
        user: req.user?.id || null,
      });
    }),
  ],
});
```

## Migration from V1

### Before (V1)
```typescript
import { ExpressAuthAdapter } from '@re-auth/http-adapters';

const adapter = new ExpressAuthAdapter(reAuthEngine, {
  path: '/auth',
  cookieName: 'token',
});

app.use('/auth', adapter.getRouter());
```

### After (V2)
```typescript
import { createExpressAdapter } from '@re-auth/http-adapters';

const adapter = createExpressAdapter(reAuthEngine, {
  basePath: '/auth', // renamed from 'path'
  cookieName: 'token',
  // New features available
  contextRules: [...],
  autoIntrospection: { enabled: true },
});

app.use('/', adapter.getRouter()); // basePath is handled internally
```

### Key Changes
1. **Import**: `ExpressAuthAdapter` → `createExpressAdapter`
2. **Config**: `path` → `basePath`
3. **Mounting**: Mount at root, adapter handles basePath internally
4. **New Features**: Context rules, auto-introspection, route overrides

## API Reference

### `createExpressAdapter(engine, config)`

Creates a new Express adapter V2 instance.

**Parameters:**
- `engine: ReAuthEngine` - The ReAuth engine instance
- `config: ExpressAdapterConfig` - Configuration options

**Returns:** `ExpressAdapterV2` - The adapter instance

### `ExpressAdapterConfig`

```typescript
interface ExpressAdapterConfig extends BaseHttpConfig {
  basePath?: string;
  cookieName?: string;
  cookieOptions?: CookieOptions;
  autoIntrospection?: AutoIntrospectionConfig;
  contextRules?: ContextExtractionRule[];
  routeOverrides?: RouteOverride[];
  customRoutes?: CustomRoute[];
  globalMiddleware?: RequestHandler[];
  errorHandler?: (error: Error, context: any) => any;
}
```

### Context Extraction Rules

```typescript
interface ContextExtractionRule {
  pluginName: string;
  stepName?: string; // Apply to specific step or all steps
  extractCookies?: string[];
  extractHeaders?: string[] | Record<string, string>;
  setCookies?: string[];
  setHeaders?: string[] | Record<string, string>;
  transformInput?: (key: string, value: any, request: any) => any;
  transformOutput?: (key: string, value: any, result: AuthOutput, request: any) => any;
}
```

## Built-in OAuth2 Context Rules

The adapter includes pre-built context rules for common OAuth providers:

```typescript
// Available OAuth2 context rules
OAuth2ContextRules.github(pluginName)   // GitHub OAuth flow
OAuth2ContextRules.google(pluginName)   // Google OAuth flow
OAuth2ContextRules.facebook(pluginName) // Facebook OAuth flow
OAuth2ContextRules.linkedin(pluginName) // LinkedIn OAuth flow

// Each provides: start, callback, and error handling rules
const githubRules = [
  OAuth2ContextRules.start('oauth-github'),
  OAuth2ContextRules.callback('oauth-github'),
  OAuth2ContextRules.pkce('oauth-github'), // For PKCE flow
];
```

## Multi-Tenant Support

```typescript
const adapter = createExpressAdapter(reAuthEngine, {
  contextRules: [
    createContextRule('*', { // Apply to all plugins
      extractHeaders: {
        'x-tenant-id': 'tenantId',
        'x-workspace': 'workspaceId',
      },
      transformInput: (key, value, request) => {
        if (key === 'tenantId' && !value) {
          // Extract from subdomain
          const host = request.headers.host;
          return host?.split('.')[0];
        }
        return value;
      },
    }),
  ],
});
```

## Error Handling

```typescript
const adapter = createExpressAdapter(reAuthEngine, {
  errorHandler: (error, context) => {
    console.error('ReAuth Error:', error);
    
    return context.response.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' 
        ? 'An error occurred' 
        : error.message,
      timestamp: new Date().toISOString(),
    });
  },
});
```

## Protection Middleware

```typescript
// Role-based protection
const adminProtection = adapter.protect({
  roles: ['admin', 'super_admin'],
});

// Custom authorization
const customProtection = adapter.protect({
  authorize: async (user, req, res, next) => {
    const hasPermission = await checkUserPermission(user.id, 'admin_access');
    return hasPermission;
  },
});

// Apply to routes
app.get('/admin/users', adminProtection, (req, res) => {
  res.json({ users: [] });
});
```

## Performance Features

- **Shared instances**: Single framework adapter instance across multiple configurations
- **Lazy route registration**: Routes only registered when needed
- **Optimized context extraction**: Rules only evaluated for applicable plugins/steps
- **Caching**: Context rules cached and reused across requests

## TypeScript Support

Full TypeScript support with proper type inference:

```typescript
// Config is fully typed
const config: ExpressAdapterConfig = {
  basePath: '/auth',
  contextRules: [
    // Autocomplete and validation available
    createContextRule('email-password', {
      extractCookies: ['session'], // ✓ Typed
      invalidField: 'test', // ✗ TypeScript error
    }),
  ],
};

// Request extensions
app.get('/profile', (req: Request, res: Response) => {
  const user = req.user; // ✓ Properly typed as Entity | undefined
  const isAuth = req.isAuthenticated(); // ✓ Properly typed as boolean
});
```

## Next Steps

- See [example-usage-v2.ts](./example-usage-v2.ts) for comprehensive examples
- Check out [Fastify Adapter V2](../fastify/README-v2.md) and [Hono Adapter V2](../hono/README-v2.md)
- Explore the [HTTP Adapter Factory](../../utils/http-adapter-factory.ts) for advanced customization 