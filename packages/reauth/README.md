# 🔐 ReAuth - Modular Authentication System

ReAuth is a flexible, plugin-based authentication system for Node.js applications. It provides a robust framework for handling various authentication methods while maintaining a clean and extensible architecture.

## 🚀 Features

- **Plugin-based Architecture**: Easily extendable with custom authentication methods
- **Multiple Authentication Flows**: Supports email/password, passwordless, and more
- **TypeScript First**: Built with TypeScript for enhanced developer experience
- **Dependency Injection**: Powered by Awilix for clean dependency management
- **Session Management**: Built-in session handling with token support
- **Extensible**: Create custom authentication plugins for any use case

## 📦 Installation

```bash
pnpm add @re-auth/reauth
# or
yarn add @re-auth/reauth
# or
npm install @re-auth/reauth
```

## 🛠️ Getting Started

### Basic Setup

```typescript
import { ReAuthEngine, emailPasswordAuth } from '@re-auth/reauth';
import { KnexEntityService, KnexSessionService } from './services';

// Initialize your entity and session services
const entityService = new KnexEntityService(knex);
const sessionService = new KnexSessionService(knex);

// Create an email/password auth plugin
const emailPassword = emailPasswordAuth({
  verifyEmail: true,
  loginOnRegister: true,
  async sendCode(entity, code, email, type) {
    // Implement your email sending logic here
    console.log(`Sending ${type} code ${code} to ${email}`);
  }
});

// Initialize the auth engine
const auth = new ReAuthEngine({
  plugins: [emailPassword],
  entity: entityService,
  session: sessionService,
  sensitiveFields: {
    password: true,
    token: true
  }
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
  codeLenght: 6, // Length of the verification code
  resetPasswordCodeExpiresIn: 30 * 60 * 1000, // 30 minutes
  
  // Required for email verification and password reset
  async sendCode(entity, code, email, type) {
    // Send email with the code
    console.log(`Sending ${type} code ${code} to ${email}`);
  },
  
  // Optional: Custom code generator
  async generateCode(email, entity) {
    return Math.floor(100000 + Math.random() * 900000); // 6-digit code
  }
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
          status: 'authenticated'
        };
      },
      inputs: ['username', 'password']
    }
  ],
  
  initialize(container) {
    // Initialize your plugin here
  },
  
  getSensitiveFields() {
    return ['password', 'token'];
  }
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
        inputs: ['username', 'password']
      }
    ];
  }
  
  private async authenticate(input: any) {
    // Your authentication logic here
    return {
      success: true,
      message: 'Authenticated successfully',
      status: 'authenticated'
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

## 📚 API Reference

### ReAuthEngine

The main authentication engine that manages plugins and authentication flows.

```typescript
const auth = new ReAuthEngine({
  plugins: AuthPlugin[],      // Array of authentication plugins
  entity: EntityService,     // Entity service implementation
  session: SessionService,   // Session service implementation
  sensitiveFields?: {        // Fields to redact in logs
    [key: string]: boolean;
  };
  authHooks?: AuthHooks[];   // Global authentication hooks
});
```

### Built-in Services

- `EntityService`: Manages user entities
- `SessionService`: Handles session management
- `KnexEntityService`: Knex-based entity service
- `KnexSessionService`: Knex-based session service

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

You can also use Standard Schema compliant validators (see [Standard Schema Support](#standard-schema-support) below).

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

[![](https://mermaid.ink/img/pako:eNpdkm9v2jAQxr-K5dcUyB-SkBebINBC100TrSZtCS9Mckk8EjtybDqK8t1nGzpVyyv7fvc8d-fcBee8ABzjsuGveU2ERC-rjCG0SL83qqIM7aCivQQBxR7d3X1Cy3TLqKSkoW-AEtI0GhjB0tIkXW1RwpkklIFAW_YbcnnLSGzGKn2W0PVocSK0IYcGNDN0ZenaUq078eNNtrbgPt0phpZQcgFow_mxt_Dewof0h-6nIBK0slPSogeLNlZnTZ94RXOLNhZtLVqUergPjlf2eFkLwQV6qQV_ZZ-Ha4-PmqEM_4Q-wzbti7Xg7JpsTPYf8r7xW9pTugOphO5D5Tn0_R6PcCVogWMpFIxwC6Il5oovRp5hWUMLGY71sSDimOGMDVrTEfaL8_ZdJriqahyXpOn1TXXmAVaUVIK0_0XXBZVc_AsSJfnzmeXvRg0nBWh8wfLcmW0wv1zXyzkraWXiSjQ6XEvZ9fFkYvC4orJWh3HO20lPC7M69WkeTAI3iIjrQRB6ZOZ5RX5w5lHp-k5ZhFPHJXgYdOfAdMGEKyZx7Ll2MlPmD46dIBo73nzmBl4QOlE4G-EzjmfOOIhCP_JD33Gd6dzXJm_2KaZjHZ_rbxp5YeS4vnYDO-7X62bbBR_-AguQ6Wg?type=png)](https://mermaid.live/edit#pako:eNpdkm9v2jAQxr-K5dcUyB-SkBebINBC100TrSZtCS9Mckk8EjtybDqK8t1nGzpVyyv7fvc8d-fcBee8ABzjsuGveU2ERC-rjCG0SL83qqIM7aCivQQBxR7d3X1Cy3TLqKSkoW-AEtI0GhjB0tIkXW1RwpkklIFAW_YbcnnLSGzGKn2W0PVocSK0IYcGNDN0ZenaUq078eNNtrbgPt0phpZQcgFow_mxt_Dewof0h-6nIBK0slPSogeLNlZnTZ94RXOLNhZtLVqUergPjlf2eFkLwQV6qQV_ZZ-Ha4-PmqEM_4Q-wzbti7Xg7JpsTPYf8r7xW9pTugOphO5D5Tn0_R6PcCVogWMpFIxwC6Il5oovRp5hWUMLGY71sSDimOGMDVrTEfaL8_ZdJriqahyXpOn1TXXmAVaUVIK0_0XXBZVc_AsSJfnzmeXvRg0nBWh8wfLcmW0wv1zXyzkraWXiSjQ6XEvZ9fFkYvC4orJWh3HO20lPC7M69WkeTAI3iIjrQRB6ZOZ5RX5w5lHp-k5ZhFPHJXgYdOfAdMGEKyZx7Ll2MlPmD46dIBo73nzmBl4QOlE4G-EzjmfOOIhCP_JD33Gd6dzXJm_2KaZjHZ_rbxp5YeS4vnYDO-7X62bbBR_-AguQ6Wg)

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

## 🔄 Standard Schema Support

ReAuth supports [Standard Schema](https://standardschema.dev/) for validation, allowing you to use any compatible validation library (like Zod, Valibot, ArkType, etc.) with your plugins.

### Using Standard Schema in a Plugin

```typescript
import { type } from 'arktype';
import { createStandardSchemaRule } from '@the-forgebase/reauth/utils';

// Define schemas using ArkType (which implements standard-schema)
const emailSchema = type('string.email');
const passwordSchema = type('string.alphanumeric >= 3');

// Create validation rules using standard-schema
const loginValidation = {
  email: createStandardSchemaRule(emailSchema, 'Please enter a valid email address'),
  password: createStandardSchemaRule(passwordSchema, 'Password must be at least 8 characters'),
};
```

### Direct Validation with Standard Schema

You can also use the `standardValidate` utility function to validate data directly:

```typescript
import { standardValidate } from '@the-forgebase/reauth/utils';
import { type } from 'arktype';

const userSchema = type({
  email: 'string.email',
  password: 'string.alphanumeric >= 8',
});

try {
  const validatedUser = await standardValidate(userSchema, userData);
  console.log('Valid user data:', validatedUser);
} catch (error) {
  console.error('Validation failed:', error);
}
```
