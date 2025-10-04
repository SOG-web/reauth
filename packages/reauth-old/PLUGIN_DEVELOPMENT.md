# Plugin Development Guide

This comprehensive guide covers everything you need to know about developing plugins for ReAuth, including object-based vs class-based patterns, validation schemas, hooks, and best practices.

## Table of Contents

1. [Plugin Architecture Overview](#plugin-architecture-overview)
2. [Object-Based vs Class-Based Patterns](#object-based-vs-class-based-patterns)
3. [Step-by-Step Plugin Creation](#step-by-step-plugin-creation)
4. [Validation Schema Usage](#validation-schema-usage)
5. [Hook System](#hook-system)
6. [Advanced Plugin Features](#advanced-plugin-features)
7. [Best Practices](#best-practices)
8. [Testing Plugins](#testing-plugins)

## Plugin Architecture Overview

ReAuth plugins are modular authentication components that implement the `AuthPlugin` interface. Each plugin consists of:

- **Steps**: Individual authentication operations (login, register, etc.)
- **Configuration**: Plugin-specific settings and options
- **Hooks**: Before/after/error handling mechanisms
- **Migration Config**: Database schema definitions
- **Dependencies**: Other plugins this plugin depends on

### Core Plugin Interface

```typescript
interface AuthPlugin<T = any> {
  name: string; // Unique plugin identifier
  steps: AuthStep<T>[]; // Authentication steps
  config: Partial<T>; // Plugin configuration
  initialize(container: AwilixContainer<ReAuthCradle>): Promise<void> | void;
  getSensitiveFields?(): string[]; // Fields to redact in logs
  migrationConfig?: PluginMigrationConfig; // Database schema
  dependsOn?: string[]; // Plugin dependencies
  rootHooks?: RootStepHooks; // Plugin-level hooks
}
```

## Object-Based vs Class-Based Patterns

ReAuth supports two plugin development patterns, each with specific use cases and benefits.

### Object-Based Plugins (Recommended for Most Cases)

Object-based plugins are simpler and suitable for stateless authentication flows. They use plain objects and functions.

**When to use:**

- Simple authentication flows
- Stateless operations
- No complex initialization logic
- Standard CRUD operations

**Example: Session Plugin**

```typescript
import { type } from 'arktype';
import { AuthPlugin, AuthStep } from '../../types';
import { createAuthPlugin } from '../utils';

// Define the plugin object
const plugin: AuthPlugin<SessionPluginConfig> = {
  name: 'session',
  steps: [
    {
      name: 'getSession',
      description: 'Get current session',
      validationSchema: type({
        token: 'string?',
        'others?': 'object | undefined',
      }),
      inputs: ['token', 'others'],
      run: async (input, pluginProperties) => {
        const { container } = pluginProperties!;
        const { token, others } = input;

        if (!token) {
          return {
            success: false,
            message: 'Token is required',
            status: 'unf',
            others,
          };
        }

        const engine = container.cradle.reAuthEngine;
        const session = await engine.checkSession(token);

        if (!session.valid) {
          return {
            success: false,
            message: 'Invalid token',
            status: 'unf',
            others,
          };
        }

        return {
          success: true,
          message: 'Session retrieved',
          status: 'su',
          entity: container.cradle.serializeEntity(session.entity!),
          others,
        };
      },
      protocol: {
        http: {
          method: 'POST',
          auth: true,
          unf: 401,
          su: 200,
        },
      },
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
        entity: 'object',
        'others?': 'object | undefined',
      }),
    },
  ],
  initialize: async function (container) {
    this.container = container;
  },
  config: {},
};

// Export factory function
const sessionPlugin = (
  config: SessionPluginConfig = {},
  overrideStep?: {
    name: string;
    override: Partial<AuthStep<SessionPluginConfig>>;
  }[],
): AuthPlugin<SessionPluginConfig> => {
  return createAuthPlugin(config, plugin, overrideStep);
};

export default sessionPlugin;
```

### Class-Based Plugins (For Complex Logic)

Class-based plugins are suitable for complex authentication flows that require state management or sophisticated initialization.

**When to use:**

- Complex initialization logic
- State management requirements
- Advanced dependency injection
- Custom service registration

**Example: Admin Plugin Pattern**

```typescript
import { AuthPlugin, AuthStep } from '../../types';
import { createAuthPlugin } from '../utils';

class AdminPluginClass implements AuthPlugin<AdminConfig> {
  name = 'adminPlugin';
  steps: AuthStep<AdminConfig>[] = [];
  config: Partial<AdminConfig> = {};

  constructor(config: AdminConfig) {
    this.config = config;
    this.initializeSteps();
  }

  private initializeSteps() {
    this.steps = [
      {
        name: 'create-admin',
        description: 'Create a new admin',
        // ... step implementation
      },
    ];
  }

  async initialize(container: AwilixContainer<ReAuthCradle>) {
    // Complex initialization logic
    if (!this.config.adminEntity) {
      throw new Error('adminEntity service is missing');
    }

    // Register custom services
    container.register({
      adminEntityService: asValue(this.config.adminEntity),
    });

    // Register hooks
    container.cradle.reAuthEngine.registerSessionHook('before', async (data, container) => {
      // Custom hook logic
      return data;
    });

    this.container = container;
  }

  getSensitiveFields() {
    return ['banned_by', 'admin_secret'];
  }
}

// Factory function
export default function adminPlugin(
  config: AdminConfig,
  overrideStep?: {
    name: string;
    override: Partial<AuthStep<AdminConfig>>;
  }[],
): AuthPlugin<AdminConfig> {
  const pluginInstance = new AdminPluginClass(config);
  return createAuthPlugin(config, pluginInstance, overrideStep, {});
}
```

## Step-by-Step Plugin Creation

### Step 1: Define Plugin Configuration Interface

```typescript
interface MyPluginConfig {
  // Required configuration
  apiKey: string;

  // Optional configuration with defaults
  timeout?: number;
  retries?: number;

  // Callback functions
  onSuccess?: (data: any) => Promise<void>;
  onError?: (error: Error) => Promise<void>;

  // Root hooks for plugin-level behavior
  rootHooks?: RootStepHooks;
}
```

### Step 2: Create Validation Schemas

```typescript
import { type } from 'arktype';

// Input validation schemas
const loginSchema = type({
  username: 'string',
  password: 'string.regex|/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[A-Za-z\\d@$!%*?&]{8,}$/',
  rememberMe: 'boolean?',
  'others?': 'object | undefined',
});

const registerSchema = type({
  username: 'string.regex|/^[a-zA-Z0-9_]{3,20}$/',
  email: 'string.email',
  password: 'string.regex|/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[A-Za-z\\d@$!%*?&]{8,}$/',
  'others?': 'object | undefined',
});

// Output validation schemas
const authOutputSchema = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  'token?': 'string',
  'entity?': 'object',
  'others?': 'object | undefined',
});
```

### Step 3: Implement Authentication Steps

```typescript
const steps: AuthStep<MyPluginConfig>[] = [
  {
    name: 'login',
    description: 'Authenticate user with username and password',
    validationSchema: loginSchema,
    outputs: authOutputSchema,
    inputs: ['username', 'password', 'rememberMe', 'others'],

    run: async function (input, pluginProperties) {
      const { container, config } = pluginProperties!;
      const { username, password, rememberMe, others } = input;

      try {
        // 1. Find user
        const entity = await container.cradle.entityService.findEntity(username, 'username');

        if (!entity) {
          return {
            success: false,
            message: 'User not found',
            status: 'user_not_found',
            others,
          };
        }

        // 2. Verify password
        const isValid = await verifyPassword(entity.password_hash, password);

        if (!isValid) {
          return {
            success: false,
            message: 'Invalid credentials',
            status: 'invalid_credentials',
            others,
          };
        }

        // 3. Create session
        const token = await container.cradle.reAuthEngine.createSession(entity, this.name);

        if (!token.success) {
          return {
            success: false,
            message: token.message!,
            status: 'session_error',
            others,
          };
        }

        // 4. Call success callback if provided
        if (config.onSuccess) {
          await config.onSuccess({ entity, token: token.token });
        }

        return {
          success: true,
          message: 'Login successful',
          token: token.token,
          entity: container.cradle.serializeEntity(entity),
          status: 'success',
          others,
        };
      } catch (error) {
        // Call error callback if provided
        if (config.onError) {
          await config.onError(error as Error);
        }

        throw error;
      }
    },

    // Protocol-specific configuration
    protocol: {
      http: {
        method: 'POST',
        user_not_found: 404,
        invalid_credentials: 401,
        session_error: 500,
        success: 200,
      },
    },

    // Step-level hooks (will be covered in hooks section)
    hooks: {},
  },
];
```

### Step 4: Create the Plugin Object

```typescript
const plugin: AuthPlugin<MyPluginConfig> = {
  name: 'myPlugin',
  steps,
  config: {},

  async initialize(container) {
    // Plugin initialization logic
    this.container = container;

    // Register custom services if needed
    if (this.config.customService) {
      container.register({
        myCustomService: asValue(this.config.customService),
      });
    }
  },

  getSensitiveFields() {
    return ['password_hash', 'api_key', 'secret_token'];
  },

  // Database migration configuration
  migrationConfig: {
    pluginName: 'myPlugin',
    extendTables: [
      {
        tableName: 'entities',
        columns: {
          username: {
            type: 'string',
            nullable: false,
            unique: true,
            index: true,
          },
          last_login: {
            type: 'timestamp',
            nullable: true,
          },
        },
      },
    ],
  },
};
```

### Step 5: Create Factory Function

```typescript
const myPlugin = (
  config: MyPluginConfig,
  overrideStep?: {
    name: string;
    override: Partial<AuthStep<MyPluginConfig>>;
  }[],
): AuthPlugin<MyPluginConfig> => {
  return createAuthPlugin(config, plugin, overrideStep, {
    // Default configuration
    timeout: 5000,
    retries: 3,
  });
};

export default myPlugin;
```

### Step 6: Extend Type Definitions

```typescript
// Extend entity types for TypeScript support
declare module '../../types' {
  interface EntityExtension {
    username?: string | null;
    last_login?: Date | null;
  }

  // Extend DI container if adding custom services
  interface ReAuthCradleExtension {
    myCustomService?: MyCustomService;
  }
}
```

## Validation Schema Usage

ReAuth uses ArkType for validation, which implements the Standard Schema specification. This provides type-safe validation with excellent TypeScript integration.

### Basic Schema Types

```typescript
import { type } from 'arktype';

// Primitive types
const stringSchema = type('string');
const numberSchema = type('number');
const booleanSchema = type('boolean');

// String with constraints
const emailSchema = type('string.email');
const urlSchema = type('string.url');

// Regex validation
const passwordSchema = type('string.regex|/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[A-Za-z\\d@$!%*?&]{8,}$/');

// Number constraints
const ageSchema = type('number.integer>0<150');
const priceSchema = type('number>=0');

// Optional fields
const optionalSchema = type({
  required: 'string',
  optional: 'string?',
});
```

### Complex Schema Patterns

```typescript
// Union types
const statusSchema = type("'active' | 'inactive' | 'pending'");

// Array validation
const tagsSchema = type('string[]');
const numbersSchema = type('number[]>0'); // Array of positive numbers

// Nested objects
const addressSchema = type({
  street: 'string',
  city: 'string',
  zipCode: 'string.regex|/^\\d{5}(-\\d{4})?$/',
  country: 'string',
});

const userSchema = type({
  name: 'string',
  email: 'string.email',
  age: 'number.integer>0<150',
  address: addressSchema,
  tags: 'string[]?',
});

// Conditional validation
const conditionalSchema = type({
  type: "'email' | 'phone'",
  contact: 'string',
}).narrow((data) => {
  if (data.type === 'email') {
    return data.contact.includes('@') ? data : 'Invalid email format';
  } else {
    return /^\+?[\d\s-()]+$/.test(data.contact) ? data : 'Invalid phone format';
  }
});
```

### Using Schemas in Steps

```typescript
const step: AuthStep<Config> = {
  name: 'updateProfile',
  description: 'Update user profile',
  validationSchema: type({
    userId: 'string',
    profile: {
      name: 'string',
      email: 'string.email',
      age: 'number.integer>0<150?',
      preferences: {
        newsletter: 'boolean?',
        notifications: 'boolean?',
      },
    },
  }),

  run: async (input, pluginProperties) => {
    // Input is automatically validated and typed
    const { userId, profile } = input;

    // TypeScript knows the exact shape of these objects
    console.log(profile.name); // string
    console.log(profile.age); // number | undefined

    // Implementation...
  },

  // Output validation
  outputs: type({
    success: 'boolean',
    message: 'string',
    updatedProfile: {
      id: 'string',
      name: 'string',
      email: 'string.email',
      updatedAt: 'Date',
    },
  }),
};
```

### Reusable Schema Components

```typescript
// Create reusable schema components
export const commonSchemas = {
  email: type('string.email'),
  password: type('string.regex|/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[A-Za-z\\d@$!%*?&]{8,}$/'),
  phone: type('string.regex|/^\\+?[1-9]\\d{1,14}$/'),
  username: type('string.regex|/^[a-zA-Z0-9_]{3,20}$/'),

  // Composite schemas
  credentials: type({
    email: 'string.email',
    password: 'string.regex|/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[A-Za-z\\d@$!%*?&]{8,}$/',
  }),

  pagination: type({
    page: 'number.integer>0',
    limit: 'number.integer>0<=100',
  }),
};

// Use in plugin steps
const loginSchema = type({
  ...commonSchemas.credentials.definition,
  rememberMe: 'boolean?',
  'others?': 'object | undefined',
});
```

## Hook System

The hook system provides powerful extension points for customizing plugin behavior at different stages of execution.

### Hook Types

ReAuth supports three types of hooks:

1. **Before Hooks**: Execute before step logic
2. **After Hooks**: Execute after step logic
3. **Error Hooks**: Execute when errors occur

### Step-Level Hooks

Step-level hooks apply to individual authentication steps:

```typescript
const step: AuthStep<Config> = {
  name: 'login',
  description: 'User login',

  hooks: {
    // Before hooks - modify input data
    before: [
      async (input, container) => {
        console.log('Before login:', input.email);

        // Add timestamp
        return {
          ...input,
          loginAttemptTime: new Date(),
        };
      },

      async (input, container) => {
        // Rate limiting check
        const rateLimiter = container.cradle.rateLimiter;
        await rateLimiter.checkLimit(input.email);

        return input;
      },
    ],

    // After hooks - modify output data
    after: [
      async (output, container) => {
        console.log('After login:', output.success);

        if (output.success) {
          // Log successful login
          const logger = container.cradle.logger;
          await logger.logEvent('user_login', {
            entityId: output.entity?.id,
            timestamp: new Date(),
          });
        }

        return output;
      },
    ],

    // Error hooks - handle errors
    onError: [
      async (error, input, container) => {
        console.error('Login error:', error.message);

        // Log failed attempt
        const logger = container.cradle.logger;
        await logger.logError('login_failed', {
          email: input.email,
          error: error.message,
          timestamp: new Date(),
        });
      },
    ],
  },

  run: async (input, pluginProperties) => {
    // Step implementation
  },
};
```

### Plugin-Level Root Hooks

Root hooks apply to all steps within a plugin:

```typescript
const plugin: AuthPlugin<Config> = {
  name: "myPlugin",
  steps: [...],

  rootHooks: {
    // Executes before any step in this plugin
    before: async (input, container, step) => {
      console.log(`Executing step: ${step.name}`);

      // Add plugin-specific data
      return {
        ...input,
        pluginName: "myPlugin",
        executionId: generateId(),
      };
    },

    // Executes after any step in this plugin
    after: async (output, container, step) => {
      console.log(`Completed step: ${step.name}`);

      // Add plugin metadata
      return {
        ...output,
        executedBy: "myPlugin",
        executionTime: Date.now(),
      };
    },

    // Executes when any step in this plugin errors
    onError: async (error, input, container, step) => {
      console.error(`Error in step ${step.name}:`, error.message);

      // Plugin-specific error handling
      await container.cradle.errorReporter.report({
        plugin: "myPlugin",
        step: step.name,
        error: error.message,
        input: sanitizeInput(input),
      });
    },
  },
};
```

### Global Engine Hooks

Register hooks that apply across all plugins:

```typescript
// In plugin initialization
async initialize(container) {
  // Session-level hooks (apply to session creation/validation)
  container.cradle.reAuthEngine.registerSessionHook(
    'before',
    async (data, container) => {
      // Check if user is banned before creating session
      const input = data as AuthInput;
      if (input.entity?.banned) {
        throw new Error('User is banned');
      }
      return data;
    }
  );

  container.cradle.reAuthEngine.registerSessionHook(
    'after',
    async (data, container) => {
      // Add session metadata
      const output = data as AuthOutput;
      return {
        ...output,
        sessionCreatedAt: new Date(),
      };
    }
  );

  // Auth-level hooks (apply to all authentication operations)
  container.cradle.reAuthEngine.registerAuthHook({
    pluginName: this.name,
    type: 'before',
    fn: async (data, container) => {
      // Global pre-processing
      console.log('Global auth hook - before');
      return data;
    },
    session: false, // Don't apply to session operations
    universal: true, // Apply to all plugins
  });
}
```

### Hook Execution Order

Hooks execute in the following order:

1. **Global Auth Hooks (before)**
2. **Plugin Root Hooks (before)**
3. **Step Hooks (before)**
4. **Step Execution**
5. **Step Hooks (after)**
6. **Plugin Root Hooks (after)**
7. **Global Auth Hooks (after)**

If an error occurs:

1. **Step Hooks (onError)**
2. **Plugin Root Hooks (onError)**
3. **Global Auth Hooks (onError)**

### Advanced Hook Patterns

#### Conditional Hooks

```typescript
const conditionalHook = async (input, container) => {
  // Only apply to certain conditions
  if (input.userType === 'premium') {
    return {
      ...input,
      premiumFeatures: await loadPremiumFeatures(input.userId),
    };
  }
  return input;
};
```

#### Async Hook Chains

```typescript
const hooks = {
  before: [
    async (input, container) => {
      // First hook - validate
      await validateInput(input);
      return input;
    },

    async (input, container) => {
      // Second hook - enrich data
      const enrichedData = await enrichUserData(input);
      return { ...input, ...enrichedData };
    },

    async (input, container) => {
      // Third hook - apply business rules
      return await applyBusinessRules(input);
    },
  ],
};
```

#### Error Recovery Hooks

```typescript
const errorHook = async (error, input, container) => {
  if (error.message.includes('rate_limit')) {
    // Implement exponential backoff
    const delay = calculateBackoffDelay(input.retryCount || 0);
    await sleep(delay);

    // Retry the operation
    throw new RetryableError('Rate limited, retrying...', {
      retryAfter: delay,
      retryCount: (input.retryCount || 0) + 1,
    });
  }

  // Log non-retryable errors
  await container.cradle.logger.logError('non_retryable_error', {
    error: error.message,
    input: sanitizeInput(input),
  });
};
```

## Advanced Plugin Features

### Plugin Dependencies

Declare dependencies on other plugins:

```typescript
const plugin: AuthPlugin<Config> = {
  name: 'advancedAuth',
  dependsOn: ['email-password', 'session'],

  async initialize(container) {
    // Check dependencies are loaded
    const dpn = checkDependsOn(container.cradle.reAuthEngine.getAllPlugins(), this.dependsOn!);

    if (!dpn.status) {
      throw new Error(`${this.name} depends on: ${dpn.pluginName.join(', ')}`);
    }

    // Dependencies are available, proceed with initialization
  },
};
```

### Custom Service Registration

Register custom services in the DI container:

```typescript
async initialize(container) {
  // Register custom services
  container.register({
    myCustomService: {
      resolve: () => new MyCustomService(this.config),
      lifetime: 'SINGLETON',
    },

    myFactory: {
      resolve: (cradle) => ({
        create: (type: string) => {
          switch (type) {
            case 'email':
              return new EmailService(cradle.config);
            case 'sms':
              return new SMSService(cradle.config);
            default:
              throw new Error(`Unknown service type: ${type}`);
          }
        },
      }),
    },
  });
}

// Extend types for TypeScript support
declare module "../../types" {
  interface ReAuthCradleExtension {
    myCustomService: MyCustomService;
    myFactory: {
      create: (type: string) => EmailService | SMSService;
    };
  }
}
```

### Database Migrations

Define database schema changes:

```typescript
const plugin: AuthPlugin<Config> = {
  migrationConfig: {
    pluginName: 'myPlugin',

    // Create new tables
    tables: [
      {
        tableName: 'user_preferences',
        columns: {
          id: {
            type: 'uuid',
            primary: true,
            nullable: false,
          },
          user_id: {
            type: 'uuid',
            nullable: false,
            references: {
              table: 'entities',
              column: 'id',
              onDelete: 'CASCADE',
            },
          },
          preferences: {
            type: 'json',
            nullable: false,
            defaultValue: '{}',
          },
        },
        indexes: [
          {
            columns: ['user_id'],
            unique: true,
          },
        ],
      },
    ],

    // Extend existing tables
    extendTables: [
      {
        tableName: 'entities',
        columns: {
          last_login_ip: {
            type: 'string',
            nullable: true,
          },
          login_count: {
            type: 'integer',
            nullable: false,
            defaultValue: 0,
          },
        },
        indexes: [
          {
            columns: ['last_login_ip'],
            name: 'idx_entities_last_login_ip',
          },
        ],
      },
    ],
  },
};
```

### Step Overrides

Allow users to customize step behavior:

```typescript
// Plugin usage with step overrides
const customPlugin = myPlugin(
  {
    apiKey: 'my-api-key',
  },
  [
    {
      name: 'login',
      override: {
        // Override the run function
        run: async (input, pluginProperties) => {
          // Custom login logic
          console.log('Custom login implementation');

          // Call original implementation or write completely new logic
          const result = await originalLoginLogic(input, pluginProperties);

          // Add custom post-processing
          return {
            ...result,
            customField: 'custom value',
          };
        },

        // Override validation schema
        validationSchema: type({
          username: 'string',
          password: 'string',
          customField: 'string?',
        }),

        // Override hooks
        hooks: {
          before: [
            async (input, container) => {
              console.log('Custom before hook');
              return input;
            },
          ],
        },
      },
    },
  ],
);
```

## Best Practices

### 1. Plugin Naming and Structure

```typescript
// Use descriptive, unique names
const plugin: AuthPlugin<Config> = {
  name: "oauth-google", // Clear, specific naming

  // Group related steps logically
  steps: [
    // OAuth flow steps
    { name: "oauth-initiate", ... },
    { name: "oauth-callback", ... },
    { name: "oauth-refresh", ... },

    // User management steps
    { name: "link-account", ... },
    { name: "unlink-account", ... },
  ],
};
```

### 2. Configuration Design

```typescript
interface PluginConfig {
  // Required configuration - no defaults
  clientId: string;
  clientSecret: string;

  // Optional with sensible defaults
  timeout?: number;
  retries?: number;

  // Feature flags
  enableAutoRegistration?: boolean;
  enableAccountLinking?: boolean;

  // Callbacks for customization
  onUserCreated?: (user: Entity) => Promise<void>;
  onError?: (error: Error, context: any) => Promise<void>;

  // Validation functions
  validateUser?: (userData: any) => boolean;

  // Custom implementations
  customUserMapper?: (externalUser: any) => Partial<Entity>;
}
```

### 3. Error Handling

```typescript
const step: AuthStep<Config> = {
  run: async (input, pluginProperties) => {
    try {
      // Main logic
      const result = await performOperation(input);

      return {
        success: true,
        message: 'Operation successful',
        status: 'success',
        data: result,
      };
    } catch (error) {
      // Log error with context
      console.error('Step failed:', {
        step: 'myStep',
        plugin: 'myPlugin',
        error: error.message,
        input: sanitizeInput(input),
      });

      // Return structured error response
      if (error instanceof ValidationError) {
        return {
          success: false,
          message: 'Validation failed',
          status: 'validation_error',
          errors: error.details,
        };
      }

      if (error instanceof NetworkError) {
        return {
          success: false,
          message: 'Network error occurred',
          status: 'network_error',
          retryable: true,
        };
      }

      // Generic error response
      return {
        success: false,
        message: 'Internal error',
        status: 'internal_error',
      };
    }
  },
};
```

### 4. Security Considerations

```typescript
const plugin: AuthPlugin<Config> = {
  // Define sensitive fields for redaction
  getSensitiveFields() {
    return ['password', 'password_hash', 'api_key', 'client_secret', 'access_token', 'refresh_token', 'verification_code'];
  },

  steps: [
    {
      run: async (input, pluginProperties) => {
        // Sanitize input data
        const sanitizedInput = sanitizeInput(input);

        // Validate permissions
        if (!hasPermission(input.entity, 'required_permission')) {
          return {
            success: false,
            message: 'Insufficient permissions',
            status: 'forbidden',
          };
        }

        // Rate limiting
        await checkRateLimit(input.entity?.id, 'operation_type');

        // Audit logging (without sensitive data)
        await auditLog({
          action: 'user_operation',
          entityId: input.entity?.id,
          timestamp: new Date(),
          metadata: sanitizedInput,
        });

        // Implementation...
      },
    },
  ],
};

// Utility functions
function sanitizeInput(input: any) {
  const { password, api_key, ...safe } = input;
  return safe;
}

function hasPermission(entity: Entity | undefined, permission: string): boolean {
  return entity?.permissions?.includes(permission) ?? false;
}
```

### 5. Testing Strategies

```typescript
// Test utilities
export const createTestContainer = () => {
  const container = createContainer();

  // Mock services
  container.register({
    entityService: {
      resolve: () => ({
        findEntity: jest.fn(),
        createEntity: jest.fn(),
        updateEntity: jest.fn(),
        deleteEntity: jest.fn(),
      }),
    },
    sessionService: {
      resolve: () => ({
        createSession: jest.fn(),
        verifySession: jest.fn(),
        destroySession: jest.fn(),
      }),
    },
  });

  return container;
};

// Plugin tests
describe('MyPlugin', () => {
  let plugin: AuthPlugin<Config>;
  let container: AwilixContainer<ReAuthCradle>;

  beforeEach(() => {
    container = createTestContainer();
    plugin = myPlugin({ apiKey: 'test-key' });
    await plugin.initialize(container);
  });

  describe('login step', () => {
    it('should authenticate valid user', async () => {
      // Arrange
      const input = {
        username: 'testuser',
        password: 'validpassword',
      };

      const mockEntity = {
        id: 'user-123',
        username: 'testuser',
        password_hash: 'hashed-password',
      };

      container.cradle.entityService.findEntity.mockResolvedValue(mockEntity);
      container.cradle.reAuthEngine.createSession.mockResolvedValue({
        success: true,
        token: 'session-token',
      });

      // Act
      const loginStep = plugin.steps.find((s) => s.name === 'login')!;
      const result = await loginStep.run(input, {
        pluginName: plugin.name,
        container,
        config: plugin.config,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.token).toBe('session-token');
      expect(container.cradle.entityService.findEntity).toHaveBeenCalledWith('testuser', 'username');
    });

    it('should handle invalid credentials', async () => {
      // Test error cases
    });

    it('should apply hooks correctly', async () => {
      // Test hook execution
    });
  });
});
```

## Testing Plugins

### Unit Testing Steps

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createTestContainer } from '../test-utils';
import myPlugin from './my-plugin';

describe('MyPlugin Steps', () => {
  let plugin: AuthPlugin<Config>;
  let container: AwilixContainer<ReAuthCradle>;

  beforeEach(async () => {
    container = createTestContainer();
    plugin = myPlugin({ apiKey: 'test-key' });
    await plugin.initialize(container);
  });

  describe('validation', () => {
    it('should validate input schema', async () => {
      const step = plugin.steps.find((s) => s.name === 'login')!;
      const invalidInput = { username: '', password: '123' }; // Too short

      // Validation should fail
      const result = await validateInputWithValidationSchema(step.validationSchema!, invalidInput);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('hooks', () => {
    it('should execute before hooks', async () => {
      const beforeHook = jest.fn().mockImplementation(async (input) => ({
        ...input,
        hookExecuted: true,
      }));

      const step = plugin.steps.find((s) => s.name === 'login')!;
      step.hooks = { before: [beforeHook] };

      await step.run(
        { username: 'test', password: 'test' },
        {
          pluginName: plugin.name,
          container,
          config: plugin.config,
        },
      );

      expect(beforeHook).toHaveBeenCalled();
    });
  });
});
```

### Integration Testing

```typescript
describe('Plugin Integration', () => {
  it('should work with ReAuth engine', async () => {
    const engine = new ReAuthEngine();
    const plugin = myPlugin({ apiKey: 'test-key' });

    // Register plugin
    engine.registerPlugin(plugin);
    await engine.initialize();

    // Test plugin execution through engine
    const result = await engine.executeStep('myPlugin', 'login', {
      username: 'testuser',
      password: 'testpass',
    });

    expect(result.success).toBe(true);
  });

  it('should handle plugin dependencies', async () => {
    const engine = new ReAuthEngine();

    // Register dependencies first
    engine.registerPlugin(emailPasswordPlugin());
    engine.registerPlugin(sessionPlugin());

    // Register dependent plugin
    const dependentPlugin = myPlugin({ apiKey: 'test-key' });
    engine.registerPlugin(dependentPlugin);

    await engine.initialize();

    // Should initialize without errors
    expect(engine.getPlugin('myPlugin')).toBeDefined();
  });
});
```

This comprehensive guide covers all aspects of plugin development in ReAuth. Use it as a reference when creating new plugins or extending existing ones. Remember to follow the established patterns and best practices for consistency and maintainability.
