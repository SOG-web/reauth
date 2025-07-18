# 🔧 ReAuth SDK Generator - HTTP Client Generation

ReAuth SDK Generator automatically generates type-safe TypeScript client libraries from ReAuth HTTP protocol introspection. This tool bridges the gap between the protocol-agnostic ReAuth Core engine and client applications by creating HTTP-specific SDKs from runtime API discovery.

## 🏗️ Architecture Role

The SDK Generator fits into the ReAuth architecture as a development tool:

```
┌─────────────────────────────────────────────────────────────┐
│                    ReAuth Core Engine                       │
│              (Protocol-Agnostic)                           │
│                                                             │
│  • Plugin System with Introspection                        │
│  • Runtime API Discovery                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                HTTP Protocol Adapter                       │
│              (@re-auth/http-adapters)                      │
│                                                             │
│  • Auto-generated HTTP Routes                              │
│  • Introspection Endpoint                                  │
│  • Runtime Schema Discovery                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP Introspection
┌─────────────────────────────────────────────────────────────┐
│                SDK Generator                                │
│              (@re-auth/sdk-generator)                      │
│                                                             │
│  • Fetches Runtime API Schema                              │
│  • Generates Type-safe Client                              │
│  • Creates Plugin-specific Methods                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ Generated SDK
┌─────────────────────────────────────────────────────────────┐
│                Client Applications                          │
│                                                             │
│  • Type-safe API Integration                               │
│  • Auto-completion & IntelliSense                         │
│  • Runtime Error Prevention                                │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Features

- **🔍 Runtime Introspection**: Discovers API schema from running ReAuth HTTP servers
- **📝 Type-safe Generation**: Creates fully typed TypeScript clients with Zod validation
- **🧩 Plugin-aware**: Generates separate modules for each ReAuth plugin
- **🔧 Configurable**: Supports multiple HTTP clients (Axios, Fetch) and authentication strategies
- **⚡ Auto-completion**: Full IntelliSense support in IDEs
- **🛡️ Runtime Safety**: Validates requests and responses at runtime
- **🔄 Hot Reload**: Regenerate SDK when backend changes during development

## 📦 Installation

```bash
# Install as a development dependency
npm install --save-dev @re-auth/sdk-generator

# Or install globally
npm install -g @re-auth/sdk-generator

# Or use with pnpm/yarn
pnpm add -D @re-auth/sdk-generator
yarn add -D @re-auth/sdk-generator
```

## 🛠️ Usage

### Prerequisites

1. **Running ReAuth HTTP Server**: You need a ReAuth server with HTTP adapters running
2. **Introspection Endpoint**: The server must expose an introspection endpoint
3. **Network Access**: The generator must be able to reach the introspection endpoint

### Command Line Interface

#### Basic Usage

```bash
# Using the binary directly
reauth-sdk-generator --url http://localhost:3001/introspect --output ./src/lib/reauth-client

# Using npx
npx @re-auth/sdk-generator --url http://localhost:3001/introspect --output ./client

# From monorepo root (development)
pnpm generate:sdk
```

#### CLI Options

```bash
reauth-sdk-generator [options]
```

**Options:**

- `--url <url>` **(Required)**: The full URL of the ReAuth introspection endpoint
- `--output <path>` **(Required)**: Directory where the generated SDK will be saved
- `--client <type>`: HTTP client type (`axios` | `fetch`) - Default: `axios`
- `--key <key>`: Authentication key for protected introspection endpoints
- `--help`: Show help information
- `--version`: Show version number

**Examples:**

```bash
# Basic generation
reauth-sdk-generator --url http://localhost:3001/introspect --output ./src/client

# With authentication key
reauth-sdk-generator --url http://localhost:3001/introspect --output ./src/client --key my-secret-key

# Using fetch instead of axios
reauth-sdk-generator --url http://localhost:3001/introspect --output ./src/client --client fetch

# Production server
reauth-sdk-generator --url https://api.myapp.com/auth/introspect --output ./src/client --key prod-key
```

### Programmatic Usage

You can also use the generator programmatically in your build scripts:

```typescript
import { generateSDK } from '@re-auth/sdk-generator';

await generateSDK({
  url: 'http://localhost:3001/introspect',
  output: './src/lib/reauth-client',
  client: 'axios',
  key: 'optional-auth-key',
});
```

## 📁 Generated Client Structure

The generator creates a complete TypeScript client with the following structure:

```
<output-path>/
├── plugins/
│   ├── email-password.ts    # Email/password authentication methods
│   ├── oauth.ts            # OAuth provider methods
│   ├── session.ts          # Session management methods
│   └── ...                 # Other plugin-specific files
├── schemas.ts              # Zod schemas and type definitions
└── index.ts               # Main client factory and exports
```

### File Descriptions

- **`index.ts`**: Main entry point exporting the `createReAuthClient` factory function
- **`schemas.ts`**: Contains Zod schemas for entities, requests, and responses
- **`plugins/`**: Plugin-specific modules with type-safe method implementations

### Generated Types

The SDK generates comprehensive TypeScript types:

```typescript
// Entity types
export interface Entity {
  id: string;
  email?: string;
  phone?: string;
  // ... other fields based on your schema
}

// Request/Response types for each plugin step
export interface EmailPasswordLoginRequest {
  email: string;
  password: string;
}

export interface EmailPasswordLoginResponse {
  success: boolean;
  entity?: Entity;
  token?: string;
  message?: string;
}
```

## 🔧 Using the Generated SDK

### Basic Client Setup

```typescript
import { createReAuthClient } from './path/to/generated/client';

// Basic setup with default axios
const authClient = createReAuthClient({
  baseURL: 'http://localhost:3001',
});

// With custom axios instance
import axios from 'axios';

const customAxios = axios.create({
  baseURL: 'http://localhost:3001',
  timeout: 5000,
});

const authClient = createReAuthClient({
  axiosInstance: customAxios,
});
```

### Authentication Methods

The generated client provides type-safe methods for each plugin:

```typescript
// Email/Password Authentication
const { data, error } = await authClient.emailPassword.login({
  email: 'user@example.com',
  password: 'password123',
});

if (data?.success) {
  console.log('Logged in:', data.entity);
}

// Registration
await authClient.emailPassword.register({
  email: 'user@example.com',
  password: 'password123',
});

// Session Management
const sessionStatus = await authClient.session.check({});
await authClient.session.logout({});
```

### Advanced Configuration

```typescript
// With authentication token storage
const authClient = createReAuthClient({
  baseURL: 'http://localhost:3001',
  auth: {
    type: 'localstorage',
    key: 'auth_token',
  },
});

// With custom token management
const authClient = createReAuthClient({
  baseURL: 'http://localhost:3001',
  auth: {
    type: 'custom',
    getToken: () => getTokenFromSecureStorage(),
  },
});

// With request/response interceptors
const authClient = createReAuthClient({
  baseURL: 'http://localhost:3001',
});

// Global request interceptor
authClient.interceptors.request.use((config) => {
  config.headers['X-Custom-Header'] = 'value';
  return config;
});

// Per-request callbacks
await authClient.emailPassword.login(
  { email, password },
  {
    onRequest: () => setLoading(true),
    onSuccess: (data) => handleSuccess(data),
    onError: (error) => handleError(error),
  },
);
```

## 🔄 Development Workflow

### 1. Backend Development

```bash
# Start your ReAuth HTTP server
cd apps/hono-test
pnpm dev
```

### 2. Generate SDK

```bash
# Generate SDK from running server
pnpm generate:sdk

# Or with custom options
reauth-sdk-generator --url http://localhost:3001/introspect --output ./src/client
```

### 3. Use in Frontend

```typescript
import { createReAuthClient } from './src/client';

const authClient = createReAuthClient({
  baseURL: 'http://localhost:3001',
});

// Type-safe API calls with auto-completion
await authClient.emailPassword.login({ email, password });
```

### 4. Regenerate on Changes

When you modify your ReAuth plugins or configuration:

```bash
# Regenerate SDK to get latest types and methods
pnpm generate:sdk
```

## 🛡️ Type Safety Benefits

The generated SDK provides comprehensive type safety:

### Compile-time Validation

```typescript
// ✅ Correct usage - TypeScript happy
await authClient.emailPassword.login({
  email: 'user@example.com',
  password: 'password123',
});

// ❌ Compile error - missing required field
await authClient.emailPassword.login({
  email: 'user@example.com',
  // password missing - TypeScript error
});

// ❌ Compile error - wrong type
await authClient.emailPassword.login({
  email: 123, // Should be string - TypeScript error
  password: 'password123',
});
```

### Runtime Validation

```typescript
// Runtime validation with Zod schemas
const result = await authClient.emailPassword.login({
  email: 'user@example.com',
  password: 'password123',
});

// Response is validated against generated schema
if (result.data?.success) {
  // TypeScript knows the exact shape of result.data
  console.log(result.data.entity?.email); // Type-safe access
}
```

### IDE Integration

- **Auto-completion**: Full IntelliSense for all methods and parameters
- **Error Detection**: Immediate feedback on type mismatches
- **Documentation**: Hover information for all generated methods
- **Refactoring**: Safe renaming and restructuring

## 🔗 Integration Examples

### React Hook

```typescript
import { useState, useEffect } from 'react';
import { createReAuthClient } from './client';

const authClient = createReAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const { data } = await authClient.session.check({});
    if (data?.valid) {
      setUser(data.entity);
    }
    setLoading(false);
  };

  const login = async (email: string, password: string) => {
    const { data, error } = await authClient.emailPassword.login({
      email,
      password,
    });

    if (data?.success) {
      setUser(data.entity);
      return { success: true };
    }

    return { success: false, error };
  };

  const logout = async () => {
    await authClient.session.logout({});
    setUser(null);
  };

  return { user, loading, login, logout };
}
```

### Vue Composable

```typescript
import { ref, onMounted } from 'vue';
import { createReAuthClient } from './client';

const authClient = createReAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
});

export function useAuth() {
  const user = ref(null);
  const loading = ref(true);

  onMounted(async () => {
    const { data } = await authClient.session.check({});
    if (data?.valid) {
      user.value = data.entity;
    }
    loading.value = false;
  });

  const login = async (credentials: { email: string; password: string }) => {
    const { data } = await authClient.emailPassword.login(credentials);
    if (data?.success) {
      user.value = data.entity;
    }
    return data;
  };

  return { user, loading, login };
}
```

## 📝 License

MIT
