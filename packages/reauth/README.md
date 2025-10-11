# 🔐 ReAuth Core - Protocol-Agnostic Authentication Engine

ReAuth Core is a **runtime, framework, and protocol-independent** authentication engine for TypeScript/JavaScript applications. It provides a universal authentication solution that works across all JS runtimes (Node.js, Deno, Bun, browsers, edge runtimes) and can be integrated with any protocol through dedicated adapters.

## 🚀 Features

- **🌐 Runtime Agnostic**: Works in Node.js, Deno, Bun, browsers, and edge runtimes
- **🔌 Protocol Independent**: Core engine works with any protocol through dedicated adapters
- **🎯 Framework Universal**: Integrates with any framework through adapter pattern
- **🧩 Plugin Architecture**: Extensible authentication methods (email/password, OAuth, passwordless, custom)
- **🔒 Session Management**: Protocol-agnostic session handling with token support
- **📡 Auto-Introspection**: Automatic API discovery and SDK generation capabilities
- **💉 Dependency Injection**: Clean architecture using Awilix container
- **✅ Type Safety**: Full TypeScript support with comprehensive type definitions
- **📋 ArkType Validation**: Type-safe validation using ArkType

## 📦 Installation

```npm
npm i @re-auth/reauth
# or
yarn add @re-auth/reauth
# or
npm install @re-auth/reauth
```

## 🛠️ Getting Started

### Protocol-Agnostic Core Setup

The ReAuth core engine is protocol-independent and requires abstract service implementations for entity and session management:

```typescript
import { ReAuthEngine, emailPasswordAuth } from '@re-auth/reauth';
import { EntityService, SessionService } from '@re-auth/reauth';

// Implement abstract services for your data layer
class MyEntityService implements EntityService {
  async create(data: any) {
    /* Your implementation */
  }
  async findById(id: string) {
    /* Your implementation */
  }
  async findByEmail(email: string) {
    /* Your implementation */
  }
  async update(id: string, data: any) {
    /* Your implementation */
  }
  async delete(id: string) {
    /* Your implementation */
  }
}

class MySessionService implements SessionService {
  async create(entityId: string, data?: any) {
    /* Your implementation */
  }
  async findById(sessionId: string) {
    /* Your implementation */
  }
  async update(sessionId: string, data: any) {
    /* Your implementation */
  }
  async delete(sessionId: string) {
    /* Your implementation */
  }
}

// Initialize your services
const entityService = new MyEntityService();
const sessionService = new MySessionService();

// Create authentication plugins (protocol-agnostic)
const emailPassword = emailPasswordAuth({
  verifyEmail: true,
  loginOnRegister: true,
  async sendCode(entity, code, email, type) {
    // Implement your notification logic (email, SMS, etc.)
    console.log(`Sending ${type} code ${code} to ${email}`);
  },
});

// Initialize the protocol-agnostic auth engine
const auth = new ReAuthEngine({
  plugins: [emailPassword],
  entity: entityService,
  session: sessionService,
  sensitiveFields: {
    password: true,
    token: true,
  },
});
```

### Integration with Protocol Adapters

The core engine integrates with any protocol through dedicated adapters. For HTTP protocol integration, use `@re-auth/http-adapters`:

```typescript
// For HTTP protocol integration
import { createHttpAdapter } from '@re-auth/http-adapters';

// The core engine works with any protocol adapter
const httpAdapter = createHttpAdapter(auth, {
  // HTTP-specific configuration
  routes: { prefix: '/auth' },
  introspection: { enabled: true },
});

// Use with your preferred HTTP framework (Express, Fastify, Hono, etc.)
```

### Universal Runtime Compatibility

The same core engine works across all JavaScript runtimes:

```typescript
// Works in Node.js, Deno, Bun, browsers, edge runtimes
const auth = new ReAuthEngine({
  plugins: [emailPassword],
  entity: entityService, // Your runtime-specific implementation
  session: sessionService, // Your runtime-specific implementation
});
```

## 🔌 Built-in Plugins

### Email/Password Authentication

```typescript
import { emailPasswordAuth } from '@re-auth/reauth';

const emailPassword = emailPasswordAuth({
  verifyEmail: true, // Require email verification
  loginOnRegister: true, // Automatically login after registration
  codeType: 'numeric', // Code type for verification/reset ('numeric' | 'alphanumeric' | 'alphabet')
  codeLength: 6, // Length of the verification code
  resetPasswordCodeExpiresIn: 30 * 60 * 1000, // 30 minutes

  // Required for email verification and password reset
  async sendCode(entity, code, email, type) {
    // Send email with the code
    console.log(`Sending ${type} code ${code} to ${email}`);
  },

  // Optional: Custom code generator
  async generateCode(email, entity) {
    return Math.floor(100000 + Math.random() * 900000); // 6-digit code
  },
});
```

## 🧩 Creating Custom Plugins

ReAuth supports two types of plugins:

### 1. Object-Based Plugin

```typescript
import { AuthPlugin } from '@re-auth/reauth';

const myPlugin: AuthPlugin = {
  name: 'my-auth-plugin',
  version: '1.0.0',

  steps: [
    {
      name: 'authenticate',
      description: 'Custom authentication step',
      async run(input, { container }) {
        // Your authentication logic here
        return {
          success: true,
          message: 'Authenticated successfully',
          status: 'authenticated',
        };
      },
      inputs: ['username', 'password'],
    },
  ],

  initialize(container) {
    // Initialize your plugin here
  },

  getSensitiveFields() {
    return ['password', 'token'];
  },
};
```

### 2. Class-Based Plugin

```typescript
import { AuthPlugin, AuthStep } from '@re-auth/reauth';

export class MyAuthPlugin implements AuthPlugin {
  name = 'my-auth-plugin';
  version = '1.0.0';
  steps: AuthStep[] = [];

  constructor(private container: any) {
    this.steps = [
      {
        name: 'authenticate',
        description: 'Custom authentication step',
        run: this.authenticate.bind(this),
        inputs: ['username', 'password'],
      },
    ];
  }

  private async authenticate(input: any) {
    // Your authentication logic here
    return {
      success: true,
      message: 'Authenticated successfully',
      status: 'authenticated',
    };
  }

  async initialize() {
    // Initialize your plugin here
  }

  getSensitiveFields() {
    return ['password', 'token'];
  }
}
```

## 📝 Logging

ReAuth provides comprehensive structured logging through the `@re-auth/logger` package. All authentication operations, plugin steps, and system events are logged with appropriate tags for easy filtering and debugging.

### Logger Configuration

```typescript
import { createDefaultLogger } from '@re-auth/logger';
import { ReAuthEngine } from '@re-auth/reauth';

// Create a logger instance
const logger = createDefaultLogger({
  prefix: 'MyApp',
  prefixEnv: 'REAUTH_',
  enabledTags: ['auth', 'session', 'plugin'],
  timestampFormat: 'human',
  emojis: true,
});

// Initialize engine with logger
const auth = new ReAuthEngine({
  plugins: [emailPassword],
  entity: entityService,
  session: sessionService,
  logger: logger, // Required logger instance
});
```

### Log Tags

ReAuth uses structured tags to categorize log messages:

- **`auth`** - Core authentication operations (login, logout, verification)
- **`session`** - Session management (creation, validation, expiration)
- **`token`** - Token operations (generation, validation, refresh)
- **`jwt`** - JWT-specific operations (signing, verification, rotation)
- **`plugin`** - Plugin-specific operations (oauth, email, phone, api-key)
- **`http`** - HTTP adapter operations (requests, responses, middleware)
- **`engine`** - Engine operations (step execution, validation, cleanup)
- **`database`** - Database operations (queries, migrations, cleanup)

### Environment Variable Control

Control logging via environment variables:

```bash
# Enable specific tags
REAUTH_DEBUG=auth,session,plugin

# Enable all tags
REAUTH_DEBUG=*

# Disable all logging
REAUTH_DEBUG=
```

### Production vs Development

- **Development**: Beautiful terminal output with colors and emojis
- **Production**: Structured JSON logging for log aggregation systems

```typescript
// Production logging (JSON format)
{"level":"info","tags":["auth"],"message":"User authentication successful","timestamp":"2024-01-15T10:30:00.000Z","prefix":"MyApp"}

// Development logging (pretty format)
[10:30:00am 15 Jan 2024] [MyApp] [auth] ℹ️ User authentication successful
```

### Migration from console.log

If you're upgrading from a version that used `console.log`, follow this migration guide:

#### Before (Old Version)

```typescript
import { ReAuthEngine } from '@re-auth/reauth';

const auth = new ReAuthEngine({
  plugins: [emailPassword],
  entity: entityService,
  session: sessionService,
  // No logger configuration
});

// Console.log statements throughout your code
console.log('User authenticated');
console.warn('Token expired');
console.error('Database connection failed');
```

#### After (New Version)

```typescript
import { ReAuthEngine } from '@re-auth/reauth';
import { createDefaultLogger } from '@re-auth/logger';

// Create logger instance
const logger = createDefaultLogger({
  prefix: 'MyApp',
  enabledTags: ['auth', 'session', 'database'],
});

const auth = new ReAuthEngine({
  plugins: [emailPassword],
  entity: entityService,
  session: sessionService,
  logger: logger, // Required logger instance
});

// Replace console.log with structured logging
logger.info('auth', 'User authenticated');
logger.warn('session', 'Token expired');
logger.error('database', 'Database connection failed');
```

#### Key Changes

1. **Add logger dependency**: Install `@re-auth/logger` package
2. **Create logger instance**: Use `createDefaultLogger()` with appropriate configuration
3. **Pass to ReAuthEngine**: Logger is now a required parameter
4. **Replace console statements**: Use structured logging with appropriate tags
5. **Configure log filtering**: Use environment variables to control which logs are shown

#### Benefits of Migration

- **Structured logging**: Consistent format across all log messages
- **Runtime control**: Enable/disable logging without code changes
- **Better debugging**: Tag-based filtering helps focus on specific issues
- **Production ready**: JSON logging for log aggregation systems
- **Beautiful output**: Colored terminal output with emojis in development

## 📚 API Reference

### ReAuthEngine

The main protocol-agnostic authentication engine that manages plugins and authentication flows.

```typescript
const auth = new ReAuthEngine({
  plugins: AuthPlugin[],      // Array of authentication plugins
  entity: EntityService,     // Abstract entity service implementation
  session: SessionService,   // Abstract session service implementation
  logger: LoggerInterface,   // Logger instance for structured logging
  sensitiveFields?: {        // Fields to redact in logs
    [key: string]: boolean;
  };
  authHooks?: AuthHooks[];   // Global authentication hooks
});
```

### Abstract Service Interfaces

The core engine works with abstract service interfaces that you implement for your specific data layer:

#### EntityService Interface

```typescript
interface EntityService {
  create(data: any): Promise<any>;
  findById(id: string): Promise<any>;
  findByEmail(email: string): Promise<any>;
  update(id: string, data: any): Promise<any>;
  delete(id: string): Promise<void>;
}
```

#### SessionService Interface

```typescript
interface SessionService {
  create(entityId: string, data?: any): Promise<any>;
  findById(sessionId: string): Promise<any>;
  update(sessionId: string, data: any): Promise<any>;
  delete(sessionId: string): Promise<void>;
}
```

### Protocol-Agnostic Session Management

The core engine provides protocol-independent session management:

```typescript
// Create a session (works with any protocol)
const session = await auth.createSession(entityId, sessionData);

// Validate a session (protocol-independent)
const validSession = await auth.validateSession(sessionId);

// Introspect authentication capabilities
const capabilities = auth.introspect();
```

### Protocol Adapter Integration

The core engine is designed to work with any protocol through dedicated adapters:

```typescript
// HTTP Protocol (via @re-auth/http-adapters)
import { createHttpAdapter } from '@re-auth/http-adapters';
const httpAdapter = createHttpAdapter(auth);

// gRPC Protocol (hypothetical future adapter)
import { createWebSocketAdapter } from '@re-auth/grpc-adapters';
const wsAdapter = createGrpcAdapter(auth);

// Custom Protocol (your own adapter)
import { createCustomAdapter } from './my-custom-adapter';
const customAdapter = createCustomAdapter(auth);
```

## 🌐 Runtime Compatibility

ReAuth Core works across all JavaScript runtimes without modification:

### Node.js

```typescript
// Standard Node.js usage
import { ReAuthEngine } from '@re-auth/reauth';
const auth = new ReAuthEngine({
  /* config */
});
```

### Deno

```typescript
// Deno usage (same API)
import { ReAuthEngine } from 'npm:@re-auth/reauth';
const auth = new ReAuthEngine({
  /* config */
});
```

### Bun

```typescript
// Bun usage (same API)
import { ReAuthEngine } from '@re-auth/reauth';
const auth = new ReAuthEngine({
  /* config */
});
```

### Edge Runtimes & Browsers

```typescript
// Works in Cloudflare Workers, Vercel Edge, browsers
import { ReAuthEngine } from '@re-auth/reauth';
const auth = new ReAuthEngine({
  /* config */
});
```

## 📝 License

MIT

## 🧱 Plugin Interface

```ts
interface AuthPlugin {
  name: string;
  version: string;
  steps: AuthStep[];
  defaultConfig?: Record<string, any>;
  requiredInput?: RequiredInputShape;
  initialize?(container?: AwilixContainer): void | Promise<void>;
}
```

## 🪜 Step Structure

Each step is a discrete auth flow like `login`, `register`, etc.

```ts
interface AuthStep {
  name: string;
  description: string;
  validationSchema?: ValidationSchema;
  run(input: AuthInput): Promise<any>;
  hooks?: {
    before?: HookFunction[];
    after?: HookFunction[];
    onError?: (error: Error, input: AuthInput) => Promise<void>;
  };
}
```

## 📑 Validation Schema

```ts
type ValidationSchema = Record<string, ((value: any, input: AuthInput) => string | undefined)[]>;
```

You can also use ArkType for validation (see [ArkType Validation Support](#arktype-validation-support) below).

## ✅ Required Input Flags

Defines what the plugin step expects:

```ts
interface RequiredInputShape {
  reqBody?: boolean;
  reqQuery?: boolean;
  reqParams?: boolean;
  reqHeaders?: boolean;
  reqMethod?: boolean;
}
```

## 🪝 Hook Types

```ts
type HookFunction = (input: AuthInput, output?: any) => Promise<void>;
```

## 🚦Plugin Lifecycle

The lifecycle of a plugin follows these steps:

[![](https://mermaid.ink/img/pako:eNpdkm9jAQxr-K5dcUyB-SkBebINBC100TrSZtCS9Mckk8EjtybDqK8t1nGzpVyyv7fvc8d-fcBee8ABzjsuGveU2ERC-rjCG0SL83qqIM7aCivQQBxR7d3X1Cy3TLqKSkoW-AEtI0GhjB0tIkXW1RwpkklIFAW_YbcnnLSGzGKn2W0PVocSK0IYcGNDN0ZenaUq078eNNtrbgPt0phpZQcgFow_mxt_Dewof0h-6nIBK0slPSogeLNlZnTZ94RXOLNhZtLVqUergPjlf2eFkLwQV6qQV_ZZ-Ha4-PmqEM_4Q-wzbti7Xg7JpsTPYf8r7xW9pTugOphO5D5Tn0_R6PcCVogWMpFIxwC6Il5oovRp5hWUMLGY71sSDimOGMDVrTEfaL8_ZdJriqahyXpOn1TXXmAVaUVIK0_0XXBZVc_AsSJfnzmeXvRg0nBWh8wfLcmW0wv1zXyzkraWXiSjQ6XEvZ9fFkYvC4orJWh3HO20lPC7M69WkeTAI3iIjrQRB6ZOZ5RX5w5lHp-k5ZhFPHJXgYdOfAdMGEKyZx7Ll2MlPmD46dIBo73nzmBl4QOlE4G-EzjmfOOIhCP_JD33Gd6dzXJm_2KaZjHZ_rbxp5YeS4vnYDO-7X62bbBR_-AguQ6Wg?type=png)](https://mermaid.live/edit#pako:eNpdkm9jAQxr-K5dcUyB-SkBebINBC100TrSZtCS9Mckk8EjtybDqK8t1nGzpVyyv7fvc8d-fcBee8ABzjsuGveU2ERC-rjCG0SL83qqIM7aCivQQBxR7d3X1Cy3TLqKSkoW-AEtI0GhjB0tIkXW1RwpkklIFAW_YbcnnLSGzGKn2W0PVocSK0IYcGNDN0ZenaUq078eNNtrbgPt0phpZQcgFow_mxt_Dewof0h-6nIBK0slPSogeLNlZnTZ94RXOLNhZtLVqUergPjlf2eFkLwQV6qQV_ZZ-Ha4-PmqEM_4Q-wzbti7Xg7JpsTPYf8r7xW9pTugOphO5D5Tn0_R6PcCVogWMpFIxwC6Il5oovRp5hWUMLGY71sSDimOGMDVrTEfaL8_ZdJriqahyXpOn1TXXmAVaUVIK0_0XXBZVc_AsSJfnzmeXvRg0nBWh8wfLcmW0wv1zXyzkraWXiSjQ6XEvZ9fFkYvC4orJWh3HO20lPC7M69WkeTAI3iIjrQRB6ZOZ5RX5w5lHp-k5ZhFPHJXgYdOfAdMGEKyZx7Ll2MlPmD46dIBo73nzmBl4QOlE4G-EzjmfOOIhCP_JD33Gd6dzXJm_2KaZjHZ_rbxp5YeS4vnYDO-7X62bbBR_-AguQ6Wg)

## ⚠️ Object Plugin Restrictions

- ❌ Do **not** use `this` in `run` functions or hooks.
- ✅ Capture context using top-level variables or closures.
- ⚠️ If plugin requires internal state, switch to class format.

## 🧪 Example Registry

```ts
export const authPlugins: AuthPlugin[] = [emailPasswordPlugin, new MagicLinkPlugin(), new OauthPlugin()];
```

## ✅ Summary

| Format       | `this` Allowed | Lifecycle Support | Best For                    |
| ------------ | -------------- | ----------------- | --------------------------- |
| Object-based | ❌ No          | ✅ Yes            | Lightweight plugins         |
| Class-based  | ✅ Yes         | ✅ Yes            | Stateful or complex plugins |

## 🔄 ArkType Validation Support

ReAuth uses [ArkType](https://arktype.io/) for type-safe validation throughout the authentication engine.

### Using ArkType in a Plugin

```typescript
import { type } from 'arktype';

// Define schemas using ArkType
const emailSchema = type('string.email');
const passwordSchema = type('string.alphanumeric >= 8');

// Use ArkType validation in your plugin
const myPlugin: AuthPlugin = {
  name: 'my-auth-plugin',
  version: '1.0.0',
  steps: [
    {
      name: 'login',
      description: 'Login with email and password',
      async run(input) {
        // Validate input using ArkType
        const emailResult = emailSchema(input.email);
        const passwordResult = passwordSchema(input.password);

        if (emailResult instanceof type.errors) {
          throw new Error('Invalid email format');
        }

        if (passwordResult instanceof type.errors) {
          throw new Error('Password must be at least 8 alphanumeric characters');
        }

        // Your authentication logic here
        return { success: true };
      },
    },
  ],
};
```

### Direct ArkType Validation

You can use ArkType directly for data validation:

```typescript
import { type } from 'arktype';

const userSchema = type({
  email: 'string.email',
  password: 'string.alphanumeric >= 8',
});

// Validate data
const result = userSchema({
  email: 'user@example.com',
  password: 'password123',
});

if (result instanceof type.errors) {
  console.error('Validation failed:', result.summary);
} else {
  console.log('Valid user data:', result);
}
```
