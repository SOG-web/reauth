# 🛠️ HTTP Adapter Development Guide

This guide provides comprehensive instructions for creating custom HTTP framework adapters for ReAuth. HTTP adapters enable the protocol-agnostic ReAuth Core engine to work with specific HTTP frameworks through a standardized interface.

## 📋 Table of Contents

- [Overview](#overview)
- [FrameworkAdapter Interface](#frameworkadapter-interface)
- [Step-by-Step Adapter Creation](#step-by-step-adapter-creation)
- [Context Extraction Rules](#context-extraction-rules)
- [HTTP Protocol Handling](#http-protocol-handling)
- [Testing Your Adapter](#testing-your-adapter)
- [Troubleshooting Guide](#troubleshooting-guide)
- [Best Practices](#best-practices)
- [Examples](#examples)

## 🎯 Overview

### Architecture Pattern

ReAuth HTTP adapters follow a three-layer architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    ReAuth Core Engine                       │
│              (Protocol-Agnostic)                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                HTTP Adapter Factory                        │
│           (Generic HTTP Protocol Logic)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              FrameworkAdapter Implementation               │
│            (Your Custom Framework Logic)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  HTTP Framework                            │
│            (Express, Fastify, Hono, etc.)                 │
└─────────────────────────────────────────────────────────────┘
```

### Key Responsibilities

Your `FrameworkAdapter` implementation handles:

- **Framework Integration**: Translating between ReAuth and your framework's APIs
- **Request/Response Handling**: Extracting inputs and formatting responses
- **Middleware Setup**: Configuring authentication middleware
- **Route Creation**: Registering HTTP routes with your framework
- **Context Management**: Handling cookies, headers, and session data
- **Error Handling**: Converting errors to appropriate HTTP responses

#

# 🔧 FrameworkAdapter Interface

The `FrameworkAdapter` interface defines the contract your adapter must implement:

```typescript
export interface FrameworkAdapter<T extends BaseHttpConfig> {
  // Core setup and route management
  setupMiddleware(context: HttpAdapterContext): void;
  createRoute(method: string, path: string, handler: any, middleware?: any[]): void;

  // Request/response handling
  extractInputs(request: any, pluginName: string, stepName: string): Promise<Record<string, any>>;
  handleStepResponse(request: any, response: any, result: AuthOutput, httpConfig: any): any;

  // Context management (cookies/headers)
  addConfigurableContextInputs(request: any, inputs: Record<string, any>, pluginName: string, stepName: string, contextRules: ContextExtractionRule[]): void;
  handleConfigurableContextOutputs(request: any, response: any, result: AuthOutput, pluginName: string, stepName: string, contextRules: ContextExtractionRule[]): void;

  // Authentication utilities
  extractToken(request: any): string | null;
  requireAuth(): any;
  errorResponse(response: any, error: Error): any;

  // Framework instance access
  getAdapter(): any;
}
```

### Method Descriptions

| Method                             | Purpose                                            | Required |
| ---------------------------------- | -------------------------------------------------- | -------- |
| `setupMiddleware`                  | Initialize framework middleware for authentication | ✅       |
| `createRoute`                      | Register HTTP routes with your framework           | ✅       |
| `extractInputs`                    | Extract authentication inputs from HTTP requests   | ✅       |
| `handleStepResponse`               | Format and send HTTP responses                     | ✅       |
| `addConfigurableContextInputs`     | Extract cookies/headers based on context rules     | ✅       |
| `handleConfigurableContextOutputs` | Set cookies/headers based on context rules         | ✅       |
| `extractToken`                     | Extract authentication tokens from requests        | ✅       |
| `requireAuth`                      | Create authentication middleware                   | ✅       |
| `errorResponse`                    | Handle error responses                             | ✅       |
| `getAdapter`                       | Return the framework instance                      | ✅       |

## 🚀 Step-by-Step Adapter Creation

### Step 1: Project Setup

Create your adapter file structure:

```
my-framework-adapter/
├── src/
│   ├── my-framework-adapter.ts
│   ├── types.ts
│   └── example-usage.ts
├── package.json
└── README.md
```

### Step 2: Define Configuration Interface

```typescript
// types.ts
import { BaseHttpConfig } from '@re-auth/http-adapters';

export interface MyFrameworkAdapterConfig extends BaseHttpConfig {
  // Add framework-specific configuration options
  prefix?: string;
  customOption?: boolean;
  middlewareOptions?: {
    timeout?: number;
    compression?: boolean;
  };
}
```

### Step 3: Implement the FrameworkAdapter

```typescript
// my-framework-adapter.ts
import { FrameworkAdapter, HttpAdapterContext, AuthOutput, ContextExtractionRule, findContextRules } from '@re-auth/http-adapters';
import { ReAuthEngine } from '@re-auth/reauth';

class MyFrameworkAdapter implements FrameworkAdapter<MyFrameworkAdapterConfig> {
  private framework: MyFramework;
  private engine?: ReAuthEngine;
  private contextRules: ContextExtractionRule[] = [];
  private adapterConfig: any = {};

  constructor(framework?: MyFramework, engine?: ReAuthEngine) {
    this.framework = framework || new MyFramework();
    this.engine = engine;
  }

  // Required for shared adapter pattern
  setEngine(engine: ReAuthEngine): void {
    this.engine = engine;
  }

  setContextRules(rules: ContextExtractionRule[]): void {
    this.contextRules = rules;
  }

  setAdapterConfig(config: any): void {
    this.adapterConfig = config;
  }

  // Implementation methods follow...
}
```

### Step 4: Implement Core Methods

#### setupMiddleware

```typescript
setupMiddleware(context: HttpAdapterContext): void {
  // Store configuration
  this.setContextRules(context.config.contextRules);
  this.setAdapterConfig({
    cookieName: context.config.cookieName || 'auth_token',
    cookieOptions: context.config.cookieOptions || {},
  });

  // Setup global middleware
  if (context.config.globalMiddleware) {
    context.config.globalMiddleware.forEach(middleware => {
      this.framework.use(middleware);
    });
  }

  // Setup authentication middleware
  this.framework.use(async (request, response, next) => {
    const token = this.extractToken(request);

    if (token) {
      try {
        const session = await context.engine.checkSession(token);
        if (session.valid && session.entity) {
          // Attach user to request (framework-specific)
          request.user = session.entity;
          request.token = session.token;
          request.isAuthenticated = true;
        }
      } catch (error) {
        console.warn('Invalid token:', error);
      }
    }

    if (!request.isAuthenticated) {
      request.isAuthenticated = false;
    }

    next();
  });
}
```

#### createRoute

`````typescript
createRoute(method: string, path: string, handler: any, middleware: any[] = []): void {
  const frameworkMethod = method.toLowerCase();

  // Apply middleware and handler to your framework
  if (middleware.length > 0) {
    this.framework[frameworkMethod](path, ...middleware, handler);
  } else {
    this.framework[frameworkMethod](path, handler);
  }
}
```
#### extractInputs

````typescript
async extractInputs(
  request: any,
  pluginName: string,
  stepName: string
): Promise<Record<string, any>> {
  // Get expected inputs from engine
  const expectedInputs = this.engine?.getStepInputs?.(pluginName, stepName) || [];
  const inputs: Record<string, any> = {};

  // Extract from request body, query, and params
  expectedInputs.forEach((inputName: string) => {
    if (request.body && request.body[inputName] !== undefined) {
      inputs[inputName] = request.body[inputName];
    } else if (request.query && request.query[inputName] !== undefined) {
      inputs[inputName] = request.query[inputName];
    } else if (request.params && request.params[inputName] !== undefined) {
      inputs[inputName] = request.params[inputName];
    }
  });

  return inputs;
}
`````

#### handleStepResponse

`````typescript
handleStepResponse(
  request: any,
  response: any,
  result: AuthOutput,
  httpConfig: any
): any {
  const { token, redirect, success, status, cookies, ...data } = result;

  // Handle token (set cookie)
  if (token) {
    response.setCookie(
      this.adapterConfig.cookieName,
      token,
      this.adapterConfig.cookieOptions
    );
  }

  // Handle additional cookies
  if (cookies) {
    Object.entries(cookies).forEach(([name, value]) => {
      response.setCookie(name, value as string);
    });
  }

  // Handle redirect
  if (redirect) {
    return response.redirect(redirect);
  }

  // Determine status code
  const statusCode = this.getStatusCode(result, httpConfig);

  // Send response (framework-specific)
  return response.status(statusCode).json({
    success,
    ...data,
  });
}

private getStatusCode(result: AuthOutput, httpConfig: any): number {
  // Check for step-specific status codes
  if (result.status && httpConfig[result.status]) {
    return httpConfig[result.status];
  }

  // Fallback to generic codes
  if (result.success && httpConfig.success) {
    return httpConfig.success;
  }
  if (!result.success && httpConfig.error) {
    return httpConfig.error;
  }

  // Standard HTTP status codes
  if (result.status === 'redirect') return 302;
  if (result.status === 'unauthorized') return 401;
  if (result.status === 'forbidden') return 403;
  if (result.status === 'not_found') return 404;
  if (result.status === 'conflict') return 409;
  if (result.status === 'error') return 400;

  return result.success ? 200 : 400;
}
```
### Step 5: Implement Context Management

#### addConfigurableContextInputs

````typescript
addConfigurableContextInputs(
  request: any,
  inputs: Record<string, any>,
  pluginName: string,
  stepName: string,
  contextRules: ContextExtractionRule[]
): void {
  const rulesToUse = contextRules.length > 0 ? contextRules : this.contextRules;
  const applicableRules = findContextRules(pluginName, stepName, rulesToUse);

  applicableRules.forEach(rule => {
    // Extract cookies
    if (rule.extractCookies && request.cookies) {
      rule.extractCookies.forEach(cookieName => {
        if (request.cookies[cookieName]) {
          let value = request.cookies[cookieName];

          // Apply transform if provided
          if (rule.transformInput) {
            value = rule.transformInput(cookieName, value, request);
          }

          inputs[cookieName] = value;
        }
      });
    }

    // Extract headers
    if (rule.extractHeaders && request.headers) {
      const headerConfig = rule.extractHeaders;

      if (Array.isArray(headerConfig)) {
        // Simple array format
        headerConfig.forEach(headerName => {
          const headerValue = request.headers[headerName.toLowerCase()];
          if (headerValue) {
            let value = headerValue;

            if (rule.transformInput) {
              value = rule.transformInput(headerName, value, request);
            }

            inputs[headerName.replace(/-/g, '_')] = value;
          }
        });
      } else {
        // Object format: { 'header-name': 'inputName' }
        Object.entries(headerConfig).forEach(([headerName, inputName]) => {
          const headerValue = request.headers[headerName.toLowerCase()];
          if (headerValue) {
            let value = headerValue;

            if (rule.transformInput) {
              value = rule.transformInput(inputName, value, request);
            }

            inputs[inputName] = value;
          }
        });
      }
    }
  });
}
`````

#### handleConfigurableContextOutputs

`````typescript
handleConfigurableContextOutputs(
  request: any,
  response: any,
  result: AuthOutput,
  pluginName: string,
  stepName: string,
  contextRules: ContextExtractionRule[]
): void {
  const rulesToUse = contextRules.length > 0 ? contextRules : this.contextRules;
  const applicableRules = findContextRules(pluginName, stepName, rulesToUse);

  applicableRules.forEach(rule => {
    // Set cookies from result
    if (rule.setCookies && response.setCookie) {
      rule.setCookies.forEach(cookieName => {
        if (result[cookieName] !== undefined) {
          let value = result[cookieName];

          if (rule.transformOutput) {
            value = rule.transformOutput(cookieName, value, result, request);
          }

          // Handle complex cookie options
          if (typeof value === 'object' && value !== null && 'value' in value) {
            const { value: cookieValue, ...cookieOptions } = value;
            response.setCookie(cookieName, cookieValue, cookieOptions);
          } else {
            response.setCookie(cookieName, value);
          }
        }
      });
    }

    // Set headers from result
    if (rule.setHeaders && response.setHeader) {
      const headerConfig = rule.setHeaders;

      if (Array.isArray(headerConfig)) {
        headerConfig.forEach(headerName => {
          const inputName = headerName.replace(/-/g, '_');
          if (result[inputName] !== undefined) {
            let value = result[inputName];

            if (rule.transformOutput) {
              value = rule.transformOutput(headerName, value, result, request);
            }

            response.setHeader(headerName, value);
          }
        });
      } else {
        Object.entries(headerConfig).forEach(([headerName, resultKey]) => {
          if (result[resultKey] !== undefined) {
            let value = result[resultKey];

            if (rule.transformOutput) {
              value = rule.transformOutput(headerName, value, result, request);
            }

            response.setHeader(headerName, value);
          }
        });
      }
    }
  });
}
```
### Step 6: Implement Authentication Utilities

````typescript
extractToken(request: any): string | null {
  // From cookie
  if (request.cookies?.[this.adapterConfig.cookieName]) {
    return request.cookies[this.adapterConfig.cookieName];
  }

  // From Authorization header
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

requireAuth(): any {
  return (request: any, response: any, next: any) => {
    if (!request.isAuthenticated) {
      return response.status(401).json({ error: 'Authentication required' });
    }
    next();
  };
}

errorResponse(response: any, error: Error): any {
  console.error('HTTP Adapter Error:', error);
  return response.status(500).json({
    success: false,
    message: error.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  });
}

getAdapter(): any {
  return this.framework;
}
`````

### Step 7: Create Factory Function

`````typescript
import { createHttpAdapter } from '@re-auth/http-adapters';

export const createMyFrameworkAdapter = (
  framework: MyFramework,
  engine: ReAuthEngine,
  config: MyFrameworkAdapterConfig
) => {
  const frameworkAdapter = new MyFrameworkAdapter(framework, engine);
  frameworkAdapter.setEngine(engine);

  const httpAdapter = createHttpAdapter(frameworkAdapter);
  return httpAdapter(engine, config);
};

// Convenience wrapper class
export class MyFrameworkAdapterV2 {
  private framework: MyFramework;
  private engine: ReAuthEngine;
  private config: MyFrameworkAdapterConfig;
  private frameworkAdapter: MyFrameworkAdapter;

  constructor(
    framework: MyFramework,
    engine: ReAuthEngine,
    config: MyFrameworkAdapterConfig = {}
  ) {
    this.framework = framework;
    this.engine = engine;
    this.config = config;
    this.frameworkAdapter = new MyFrameworkAdapter(framework, engine);

    // Create the adapter
    createMyFrameworkAdapter(framework, engine, config);
  }

  getFramework(): MyFramework {
    return this.framework;
  }

  addRoute(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    handler: any,
    options: { middleware?: any[]; requireAuth?: boolean } = {}
  ): void {
    const middleware = options.middleware || [];

    if (options.requireAuth) {
      middleware.push(this.frameworkAdapter.requireAuth());
    }

    this.frameworkAdapter.createRoute(method, path, handler, middleware);
  }

  protect(options: { roles?: string[]; authorize?: Function } = {}) {
    return (request: any, response: any, next: any) => {
      if (!request.isAuthenticated) {
        return response.status(401).json({ error: 'Authentication required' });
      }

      if (options.roles && options.roles.length > 0) {
        const userRole = request.user?.role;
        if (!userRole || !options.roles.includes(userRole)) {
          return response.status(403).json({ error: 'Insufficient permissions' });
        }
      }

      if (options.authorize) {
        const isAuthorized = options.authorize(request.user, request, response);
        if (!isAuthorized) {
          return response.status(403).json({ error: 'Access denied' });
        }
      }

      next();
    };
  }
}
```
## 🍪 Context Extraction Rules

Context extraction rules allow your adapter to handle HTTP-specific data like cookies and headers based on plugin and step combinations.

### Rule Structure

````typescript
interface ContextExtractionRule {
  pluginName: string;
  stepName?: string; // Optional - applies to all steps if not specified
  extractCookies?: string[];
  extractHeaders?: string[] | Record<string, string>;
  setCookies?: string[];
  setHeaders?: string[] | Record<string, string>;
  transformInput?: (key: string, value: any, request: any) => any;
  transformOutput?: (key: string, value: any, result: AuthOutput, request: any) => any;
}
`````

### Common Patterns

#### OAuth Flow Context Rules

```typescript
// OAuth state management
const oauthContextRule: ContextExtractionRule = {
  pluginName: 'oauth-github',
  stepName: 'callback',
  extractCookies: ['oauth_state', 'oauth_code_verifier'],
  transformInput: (key, value, request) => {
    if (key === 'oauth_state') {
      // Validate state parameter
      const queryState = request.query.state;
      return value === queryState ? value : null;
    }
    return value;
  },
};
```

#### API Key Authentication

```typescript
const apiKeyRule: ContextExtractionRule = {
  pluginName: 'api-key',
  extractHeaders: { 'x-api-key': 'apiKey' },
  transformInput: (key, value, request) => {
    if (key === 'apiKey') {
      // Validate API key format
      return value.startsWith('ak_') ? value : null;
    }
    return value;
  },
};
```

#### Multi-tenant Context

```typescript
const tenantRule: ContextExtractionRule = {
  pluginName: '*', // Apply to all plugins
  extractHeaders: { 'x-tenant-id': 'tenantId' },
  extractCookies: ['tenant_preference'],
  setCookies: ['tenant_session'],
  transformInput: (key, value, request) => {
    if (key === 'tenantId' && !value) {
      // Extract from subdomain if not in header
      const host = request.headers.host;
      const subdomain = host?.split('.')[0];
      return subdomain !== 'www' ? subdomain : null;
    }
    return value;
  },
};
```

## 🌐 HTTP Protocol Handling

### Request Processing Flow

1. **Middleware Setup**: Authentication middleware runs on every request
2. **Route Matching**: HTTP adapter matches request to plugin step
3. **Input Extraction**: Extract inputs from body, query, params
4. **Context Extraction**: Apply context rules for cookies/headers
5. **Step Execution**: Execute ReAuth plugin step
6. **Response Handling**: Format response and set cookies/headers
7. **Error Handling**: Convert errors to appropriate HTTP responses

### Status Code Mapping

Your adapter should map ReAuth results to appropriate HTTP status codes:

```typescript
private getStatusCode(result: AuthOutput, httpConfig: any): number {
  // Plugin-specific status codes
  if (result.status && httpConfig[result.status]) {
    return httpConfig[result.status];
  }

  // Generic success/error codes
  if (result.success && httpConfig.success) return httpConfig.success;
  if (!result.success && httpConfig.error) return httpConfig.error;

  // Standard HTTP status codes
  switch (result.status) {
    case 'redirect': return 302;
    case 'unauthorized': return 401;
    case 'forbidden': return 403;
    case 'not_found': return 404;
    case 'conflict': return 409;
    case 'error': return 400;
    default: return result.success ? 200 : 400;
  }
}
```

### Cookie Management

Handle authentication cookies securely:

`````typescript
// Setting secure cookies
if (token) {
  response.setCookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

// Clearing cookies on logout
response.clearCookie(cookieName, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
});
```
## 🧪 Testing Your Adapter

### Unit Tests

````typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ReAuthEngine } from '@re-auth/reauth';
import { MyFrameworkAdapter } from './my-framework-adapter';

describe('MyFrameworkAdapter', () => {
  let adapter: MyFrameworkAdapter;
  let mockFramework: any;
  let mockEngine: ReAuthEngine;

  beforeEach(() => {
    mockFramework = {
      use: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
    };

    mockEngine = {
      getStepInputs: vi.fn().mockReturnValue(['email', 'password']),
      executeStep: vi.fn(),
      checkSession: vi.fn(),
    } as any;

    adapter = new MyFrameworkAdapter(mockFramework, mockEngine);
  });

  it('should extract inputs correctly', async () => {
    const mockRequest = {
      body: { email: 'test@example.com', password: 'password123' },
      query: {},
      params: {},
    };

    const inputs = await adapter.extractInputs(mockRequest, 'email-password', 'login');

    expect(inputs).toEqual({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('should extract token from cookie', () => {
    const mockRequest = {
      cookies: { auth_token: 'test-token' },
      headers: {},
    };

    const token = adapter.extractToken(mockRequest);
    expect(token).toBe('test-token');
  });

  it('should extract token from Authorization header', () => {
    const mockRequest = {
      cookies: {},
      headers: { authorization: 'Bearer test-token' },
    };

    const token = adapter.extractToken(mockRequest);
    expect(token).toBe('test-token');
  });
});
```

### Integration Tests

````typescript
import { describe, it, expect } from 'vitest';
import { ReAuthEngine, emailPasswordAuth } from '@re-auth/reauth';
import { createMyFrameworkAdapter } from './my-framework-adapter';

describe('MyFrameworkAdapter Integration', () => {
  it('should handle complete authentication flow', async () => {
    const engine = new ReAuthEngine({
      plugins: [emailPasswordAuth()],
      entity: mockEntityService,
      session: mockSessionService,
    });

    const framework = new MyFramework();
    const adapter = createMyFrameworkAdapter(framework, engine, {
      basePath: '/auth',
      cookieName: 'test_token',
    });

    // Test route creation
    expect(framework.routes).toHaveLength(2); // login and register routes

    // Test middleware setup
    expect(framework.middleware).toHaveLength(1); // auth middleware
  });
});
```
## 🔧 Troubleshooting Guide

### Common Issues and Solutions

#### Issue: Routes Not Being Created

**Symptoms:**
- HTTP adapter factory runs without errors
- No routes are registered with your framework
- 404 errors when accessing auth endpoints

**Causes & Solutions:**

1. **Framework instance not properly initialized**
   ```typescript
   // ❌ Wrong - framework not initialized
   const adapter = new MyFrameworkAdapter();

   // ✅ Correct - pass initialized framework
   const framework = new MyFramework();
   const adapter = new MyFrameworkAdapter(framework);
`````

2. **createRoute method not implemented correctly**

   ```typescript
   // ❌ Wrong - method name mismatch
   createRoute(method: string, path: string, handler: any): void {
     this.framework.route(method, path, handler); // Wrong method name
   }

   // ✅ Correct - use framework's actual method
   createRoute(method: string, path: string, handler: any): void {
     const frameworkMethod = method.toLowerCase();
     this.framework[frameworkMethod](path, handler);
   }
   ```

3. **Auto-introspection disabled or no plugins with HTTP protocol**
   ```typescript
   // ✅ Check plugin HTTP configuration
   const plugin = {
     name: 'my-plugin',
     steps: [
       {
         name: 'my-step',
         protocol: {
           http: {
             // This is required for auto-route generation
             method: 'POST',
             auth: false,
           },
         },
       },
     ],
   };
   ```

#### Issue: Input Extraction Failing

**Symptoms:**

- Authentication steps receive empty or incorrect inputs
- Validation errors for required fields
- Request data not being parsed

**Causes & Solutions:**

1. **Body parsing not configured**

   ```typescript
   // ✅ Ensure body parsing middleware is set up
   setupMiddleware(context: HttpAdapterContext): void {
     // Add body parsing middleware before auth middleware
     this.framework.use(bodyParser.json());
     this.framework.use(bodyParser.urlencoded({ extended: true }));

     // Then setup auth middleware
     this.setupAuthMiddleware(context);
   }
   ```

2. **Incorrect input extraction logic**

   ```typescript
   // ❌ Wrong - not checking all sources
   async extractInputs(request: any, pluginName: string, stepName: string) {
     return request.body || {};
   }

   // ✅ Correct - check body, query, and params
   async extractInputs(request: any, pluginName: string, stepName: string) {
     const expectedInputs = this.engine?.getStepInputs?.(pluginName, stepName) || [];
     const inputs: Record<string, any> = {};

     expectedInputs.forEach(inputName => {
       if (request.body?.[inputName] !== undefined) {
         inputs[inputName] = request.body[inputName];
       } else if (request.query?.[inputName] !== undefined) {
         inputs[inputName] = request.query[inputName];
       } else if (request.params?.[inputName] !== undefined) {
         inputs[inputName] = request.params[inputName];
       }
     });

     return inputs;
   }
   ```

#### Issue: Context Rules Not Working

**Symptoms:**

- Cookies or headers not being extracted
- OAuth flows failing due to missing state
- Context data not being set in responses

**Causes & Solutions:**

1. **Context rules not being applied**

   ```typescript
   // ✅ Ensure context rules are called in step handler
   const stepHandler = async (request: any, response: any) => {
     const inputs = await this.extractInputs(request, pluginName, stepName);

     // This is crucial - apply context rules
     this.addConfigurableContextInputs(request, inputs, pluginName, stepName, contextRules);

     const result = await engine.executeStep(pluginName, stepName, inputs);

     // Also apply output context rules
     this.handleConfigurableContextOutputs(request, response, result, pluginName, stepName, contextRules);

     return this.handleStepResponse(request, response, result, httpConfig);
   };
   ```

2. **Cookie parsing not configured**

   ````typescript
   // ✅ Setup cookie parsing middleware
   setupMiddleware(context: HttpAdapterContext): void {
     // Add cookie parsing
     this.framework.use(cookieParser());

     // Or manual cookie parsing if no middleware available
     this.framework.use((request, response, next) => {
       if (!request.cookies) {
         const cookieHeader = request.headers.cookie || '';
         request.cookies = cookieHeader
           .split(';')
           .reduce((cookies, cookie) => {
             const [name, value] = cookie.trim().split('=');
             if (name && value) cookies[name] = value;
             return cookies;
           }, {});
       }
       next();
     });
   }
   ```
   ````

#### Issue: Authentication Middleware Not Working

**Symptoms:**

- `request.user` is always undefined
- `request.isAuthenticated` is always false
- Protected routes not working

**Causes & Solutions:**

1. **Token extraction failing**

   ```typescript
   // ✅ Debug token extraction
   extractToken(request: any): string | null {
     console.log('Cookies:', request.cookies);
     console.log('Headers:', request.headers);

     // Check cookie
     const cookieToken = request.cookies?.[this.adapterConfig.cookieName];
     if (cookieToken) {
       console.log('Found token in cookie:', cookieToken);
       return cookieToken;
     }

     // Check Authorization header
     const authHeader = request.headers.authorization;
     if (authHeader?.startsWith('Bearer ')) {
       const token = authHeader.substring(7);
       console.log('Found token in header:', token);
       return token;
     }

     console.log('No token found');
     return null;
   }
   ```

2. **Session validation failing**

   ```typescript
   // ✅ Add error handling and logging
   setupMiddleware(context: HttpAdapterContext): void {
     this.framework.use(async (request, response, next) => {
       const token = this.extractToken(request);

       if (token) {
         try {
           console.log('Validating token:', token);
           const session = await context.engine.checkSession(token);
           console.log('Session result:', session);

           if (session.valid && session.entity) {
             request.user = session.entity;
             request.token = session.token;
             request.isAuthenticated = true;
           } else {
             console.log('Invalid session');
           }
         } catch (error) {
           console.error('Session validation error:', error);
         }
       }

       if (!request.isAuthenticated) {
         request.isAuthenticated = false;
       }

       next();
     });
   }
   ```

#### Issue: Response Handling Problems

**Symptoms:**

- Responses not being sent correctly
- Cookies not being set
- Redirects not working

**Causes & Solutions:**

1. **Framework-specific response methods**

   ```typescript
   // ❌ Wrong - assuming Express-like API
   handleStepResponse(request: any, response: any, result: AuthOutput) {
     return response.status(200).json(result); // May not work for all frameworks
   }

   // ✅ Correct - handle different response patterns
   handleStepResponse(request: any, response: any, result: AuthOutput) {
     const statusCode = this.getStatusCode(result, httpConfig);

     // Handle different framework response patterns
     if (response.json) {
       // Express-like
       return response.status(statusCode).json(result);
     } else if (response.send) {
       // Fastify-like
       return response.status(statusCode).send(result);
     } else {
       // Hono/Web API-like - return Response object
       return new Response(JSON.stringify(result), {
         status: statusCode,
         headers: { 'Content-Type': 'application/json' }
       });
     }
   }
   ```

2. **Cookie setting issues**
   ```typescript
   // ✅ Handle different cookie APIs
   private setCookie(response: any, name: string, value: string, options: any) {
     if (response.cookie) {
       // Express/Fastify-like
       response.cookie(name, value, options);
     } else if (response.setCookie) {
       // Custom framework
       response.setCookie(name, value, options);
     } else {
       // Web API-like (Hono)
       const cookieString = `${name}=${value}; ${Object.entries(options)
         .map(([k, v]) => `${k}=${v}`)
         .join('; ')}`;
       response.headers.set('Set-Cookie', cookieString);
     }
   }
   ```

### Debugging Tips

1. **Enable Debug Logging**

   ```typescript
   const DEBUG = process.env.DEBUG === 'true';

   private log(message: string, data?: any) {
     if (DEBUG) {
       console.log(`[MyFrameworkAdapter] ${message}`, data);
     }
   }
   ```

2. **Validate Configuration**

   ```typescript
   setupMiddleware(context: HttpAdapterContext): void {
     this.log('Setting up middleware with config:', context.config);
     this.log('Context rules:', context.config.contextRules);
     this.log('Auto-generated routes:', context.autoGeneratedRoutes);

     // Continue with setup...
   }
   ```

3. **Test with Minimal Example**

   ````typescript
   // Create minimal test to isolate issues
   const testAdapter = () => {
     const framework = new MyFramework();
     const engine = new ReAuthEngine({ /* minimal config */ });
     const adapter = new MyFrameworkAdapter(framework, engine);

     // Test each method individually
     console.log('Testing extractToken...');
     const token = adapter.extractToken({ cookies: { auth_token: 'test' } });
     console.log('Token:', token);
   };
   ```##
   ✅ Best Practices
   ````

### Security

1. **Secure Cookie Configuration**

   ```typescript
   const secureCookieOptions = {
     httpOnly: true,
     secure: process.env.NODE_ENV === 'production',
     sameSite: 'lax' as const,
     maxAge: 60 * 60 * 24 * 7, // 7 days
     path: '/',
   };
   ```

2. **Input Validation**

   ```typescript
   async extractInputs(request: any, pluginName: string, stepName: string) {
     const inputs = await this.baseExtractInputs(request, pluginName, stepName);

     // Sanitize inputs
     Object.keys(inputs).forEach(key => {
       if (typeof inputs[key] === 'string') {
         inputs[key] = inputs[key].trim();
       }
     });

     return inputs;
   }
   ```

3. **Error Information Disclosure**

   ```typescript
   errorResponse(response: any, error: Error): any {
     const isDevelopment = process.env.NODE_ENV === 'development';

     return response.status(500).json({
       success: false,
       message: isDevelopment ? error.message : 'Internal server error',
       error: isDevelopment ? error.stack : undefined,
     });
   }
   ```

### Performance

1. **Efficient Route Registration**

   ```typescript
   // Cache route handlers to avoid recreation
   private routeHandlers = new Map<string, any>();

   createRoute(method: string, path: string, handler: any, middleware?: any[]): void {
     const routeKey = `${method}:${path}`;

     if (!this.routeHandlers.has(routeKey)) {
       this.routeHandlers.set(routeKey, handler);
       this.framework[method.toLowerCase()](path, ...middleware, handler);
     }
   }
   ```

2. **Lazy Initialization**

   ```typescript
   private _contextRules?: ContextExtractionRule[];

   get contextRules(): ContextExtractionRule[] {
     if (!this._contextRules) {
       this._contextRules = this.initializeContextRules();
     }
     return this._contextRules;
   }
   ```

### Maintainability

1. **Clear Method Separation**

   ```typescript
   // Separate concerns into focused methods
   class MyFrameworkAdapter implements FrameworkAdapter<MyFrameworkAdapterConfig> {
     // Core setup
     setupMiddleware(context: HttpAdapterContext): void {
       /* ... */
     }

     // Request handling
     async extractInputs(/* ... */): Promise<Record<string, any>> {
       /* ... */
     }
     private extractFromBody(/* ... */): Record<string, any> {
       /* ... */
     }
     private extractFromQuery(/* ... */): Record<string, any> {
       /* ... */
     }

     // Response handling
     handleStepResponse(/* ... */): any {
       /* ... */
     }
     private formatSuccessResponse(/* ... */): any {
       /* ... */
     }
     private formatErrorResponse(/* ... */): any {
       /* ... */
     }

     // Context management
     addConfigurableContextInputs(/* ... */): void {
       /* ... */
     }
     handleConfigurableContextOutputs(/* ... */): void {
       /* ... */
     }
   }
   ```

2. **Configuration Validation**

   ````typescript
   constructor(framework?: MyFramework, engine?: ReAuthEngine) {
     this.framework = framework || new MyFramework();
     this.engine = engine;

     // Validate framework compatibility
     this.validateFramework();
   }

   private validateFramework(): void {
     const requiredMethods = ['use', 'get', 'post', 'put', 'delete'];

     requiredMethods.forEach(method => {
       if (typeof this.framework[method] !== 'function') {
         throw new Error(`Framework missing required method: ${method}`);
       }
     });
   }
   ```
   ````

## 📚Examples

### Complete Minimal Adapter

Here's a complete minimal adapter implementation:

```typescript
import { FrameworkAdapter, HttpAdapterContext, AuthOutput, ContextExtractionRule, findContextRules, createHttpAdapter } from '@re-auth/http-adapters';
import { ReAuthEngine } from '@re-auth/reauth';

// Simple framework interface
interface SimpleFramework {
  use(middleware: any): void;
  get(path: string, ...handlers: any[]): void;
  post(path: string, ...handlers: any[]): void;
  put(path: string, ...handlers: any[]): void;
  delete(path: string, ...handlers: any[]): void;
}

class SimpleFrameworkAdapter implements FrameworkAdapter<any> {
  private framework: SimpleFramework;
  private engine?: ReAuthEngine;
  private contextRules: ContextExtractionRule[] = [];
  private adapterConfig: any = {};

  constructor(framework: SimpleFramework, engine?: ReAuthEngine) {
    this.framework = framework;
    this.engine = engine;
  }

  setEngine(engine: ReAuthEngine): void {
    this.engine = engine;
  }

  setContextRules(rules: ContextExtractionRule[]): void {
    this.contextRules = rules;
  }

  setAdapterConfig(config: any): void {
    this.adapterConfig = config;
  }

  setupMiddleware(context: HttpAdapterContext): void {
    this.setContextRules(context.config.contextRules);
    this.setAdapterConfig({
      cookieName: context.config.cookieName || 'auth_token',
      cookieOptions: context.config.cookieOptions || {},
    });

    // Auth middleware
    this.framework.use(async (request: any, response: any, next: any) => {
      const token = this.extractToken(request);

      if (token) {
        try {
          const session = await context.engine.checkSession(token);
          if (session.valid && session.entity) {
            request.user = session.entity;
            request.token = session.token;
            request.isAuthenticated = true;
          }
        } catch (error) {
          console.warn('Invalid token:', error);
        }
      }

      if (!request.isAuthenticated) {
        request.isAuthenticated = false;
      }

      next();
    });
  }

  createRoute(method: string, path: string, handler: any, middleware: any[] = []): void {
    const frameworkMethod = method.toLowerCase() as keyof SimpleFramework;
    if (typeof this.framework[frameworkMethod] === 'function') {
      (this.framework[frameworkMethod] as any)(path, ...middleware, handler);
    }
  }

  async extractInputs(request: any, pluginName: string, stepName: string): Promise<Record<string, any>> {
    const expectedInputs = this.engine?.getStepInputs?.(pluginName, stepName) || [];
    const inputs: Record<string, any> = {};

    expectedInputs.forEach((inputName: string) => {
      if (request.body?.[inputName] !== undefined) {
        inputs[inputName] = request.body[inputName];
      } else if (request.query?.[inputName] !== undefined) {
        inputs[inputName] = request.query[inputName];
      } else if (request.params?.[inputName] !== undefined) {
        inputs[inputName] = request.params[inputName];
      }
    });

    return inputs;
  }

  addConfigurableContextInputs(request: any, inputs: Record<string, any>, pluginName: string, stepName: string, contextRules: ContextExtractionRule[]): void {
    const rulesToUse = contextRules.length > 0 ? contextRules : this.contextRules;
    const applicableRules = findContextRules(pluginName, stepName, rulesToUse);

    applicableRules.forEach((rule) => {
      if (rule.extractCookies && request.cookies) {
        rule.extractCookies.forEach((cookieName) => {
          if (request.cookies[cookieName]) {
            inputs[cookieName] = request.cookies[cookieName];
          }
        });
      }

      if (rule.extractHeaders && request.headers) {
        const headerConfig = rule.extractHeaders;
        if (Array.isArray(headerConfig)) {
          headerConfig.forEach((headerName) => {
            const headerValue = request.headers[headerName.toLowerCase()];
            if (headerValue) {
              inputs[headerName.replace(/-/g, '_')] = headerValue;
            }
          });
        }
      }
    });
  }

  handleConfigurableContextOutputs(request: any, response: any, result: AuthOutput, pluginName: string, stepName: string, contextRules: ContextExtractionRule[]): void {
    const rulesToUse = contextRules.length > 0 ? contextRules : this.contextRules;
    const applicableRules = findContextRules(pluginName, stepName, rulesToUse);

    applicableRules.forEach((rule) => {
      if (rule.setCookies && response.cookie) {
        rule.setCookies.forEach((cookieName) => {
          if (result[cookieName] !== undefined) {
            response.cookie(cookieName, result[cookieName]);
          }
        });
      }
    });
  }

  handleStepResponse(request: any, response: any, result: AuthOutput, httpConfig: any): any {
    const { token, redirect, success, ...data } = result;

    if (token) {
      response.cookie(this.adapterConfig.cookieName, token, this.adapterConfig.cookieOptions);
    }

    if (redirect) {
      return response.redirect(redirect);
    }

    const statusCode = result.success ? 200 : 400;
    return response.status(statusCode).json({ success, ...data });
  }

  extractToken(request: any): string | null {
    if (request.cookies?.[this.adapterConfig.cookieName]) {
      return request.cookies[this.adapterConfig.cookieName];
    }

    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }

  requireAuth(): any {
    return (request: any, response: any, next: any) => {
      if (!request.isAuthenticated) {
        return response.status(401).json({ error: 'Authentication required' });
      }
      next();
    };
  }

  errorResponse(response: any, error: Error): any {
    return response.status(500).json({
      success: false,
      message: error.message,
    });
  }

  getAdapter(): SimpleFramework {
    return this.framework;
  }
}

// Factory function
export const createSimpleFrameworkAdapter = (framework: SimpleFramework, engine: ReAuthEngine, config: any = {}) => {
  const frameworkAdapter = new SimpleFrameworkAdapter(framework, engine);
  const httpAdapter = createHttpAdapter(frameworkAdapter);
  return httpAdapter(engine, config);
};
```

This guide provides everything you need to create a custom HTTP adapter for ReAuth. Remember to test thoroughly and follow the security best practices outlined above.

---

## 🎉 Conclusion

Creating a custom HTTP adapter for ReAuth involves implementing the `FrameworkAdapter` interface to bridge between the protocol-agnostic ReAuth Core engine and your specific HTTP framework. The key is understanding the separation of concerns:

- **ReAuth Core**: Handles authentication logic independently of protocols
- **HTTP Adapter Factory**: Provides generic HTTP protocol handling
- **Your FrameworkAdapter**: Translates between HTTP concepts and your framework's APIs

By following this guide, you'll create adapters that are secure, performant, and maintainable while leveraging ReAuth's powerful plugin system and protocol independence.

For questions or contributions, please refer to the main ReAuth documentation or open an issue in the repository.
