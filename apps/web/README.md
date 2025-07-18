# ReAuth Client SDK Example

This Next.js application demonstrates how to use the generated ReAuth client SDK to interact with a ReAuth HTTP backend. It showcases client-side integration patterns and the separation between the protocol-agnostic ReAuth Core and HTTP protocol implementation.

## 🏗️ Architecture Demonstration

This example illustrates the client-side integration with ReAuth:

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Client Application               │
│              (Frontend)                                     │
│                                                             │
│  • Generated ReAuth Client SDK                              │
│  • Type-safe API Integration                               │
│  • Authentication UI Components                            │
│  • Session Management                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP Requests
┌─────────────────────────────────────────────────────────────┐
│                ReAuth HTTP Backend                          │
│              (apps/hono-test)                              │
│                                                             │
│  • HTTP Protocol Adapter                                   │
│  • Auto-generated Routes                                   │
│  • Protocol-agnostic Core Engine                          │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Features Demonstrated

- **Generated Client SDK**: Type-safe client generated from ReAuth HTTP introspection
- **Multiple HTTP Clients**: Support for custom Axios instances and configurations
- **Authentication Flows**: Email/password and phone/password authentication
- **Session Management**: Client-side session handling with various storage options
- **Request Interceptors**: Global and per-request interceptor support
- **Error Handling**: Comprehensive error handling with custom callbacks
- **Type Safety**: Full TypeScript support with generated types

## 🛠️ Setup and Installation

### Prerequisites

- Node.js >= 18
- pnpm (recommended) or npm
- Running ReAuth backend (see [hono-test example](../hono-test/README.md))

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The application will start on `http://localhost:3000`

### Backend Dependency

This client application requires the ReAuth backend to be running. Start the backend first:

```bash
# In the hono-test directory
cd ../hono-test
pnpm install
pnpm dev
```

The backend should be running on `http://localhost:3001`

## 📱 Client SDK Usage

### Basic Client Setup

The ReAuth client is configured in `lib/reauth-client/index.ts`:

```typescript
import { createReAuthClient } from '@/lib/reauth-client';
import axios from 'axios';

// Create custom axios instance
const customAxiosInstance = axios.create({
  baseURL: 'http://localhost:3001',
  timeout: 5000,
});

// Initialize ReAuth client
const authClient = createReAuthClient({
  axiosInstance: customAxiosInstance,
  auth: {
    type: 'custom',
    getToken: () => {
      return localStorage.getItem('auth_token');
    },
  },
});
```

### Authentication Methods

#### Email/Password Authentication

```typescript
// Register
const { data, error } = await authClient.email.register(
  {
    email: 'user@example.com',
    password: 'password123',
  },
  {
    onRequest: () => setLoading(true),
    onSuccess: (data) => console.log('Registration successful:', data),
    onError: (error) => console.error('Registration failed:', error),
  },
);

// Login
const { data, error } = await authClient.email.login(
  {
    email: 'user@example.com',
    password: 'password123',
  },
  {
    onSuccess: (data) => {
      // Handle successful login
      if (data.entity) {
        setUser(data.entity);
      }
    },
    onError: (error) => {
      // Handle login error
      setError(error.message);
    },
  },
);
```

#### Session Management

```typescript
// Check session status
const { data, error } = await authClient.session.check(
  {},
  {
    onSuccess: (data) => {
      if (data.valid) {
        setUser(data.entity);
      }
    },
  },
);

// Logout
const { data, error } = await authClient.session.logout(
  {},
  {
    onSuccess: () => {
      setUser(null);
      // Clear local storage, redirect, etc.
    },
  },
);
```

### Advanced Features

#### Custom Request Interceptors

```typescript
// Global interceptor
const requestInterceptor = authClient.interceptors.request.use((config) => {
  console.log('Global request interceptor:', config);
  return config;
});

// Per-request interceptor
await authClient.email.login(
  { email, password },
  {
    interceptors: {
      response: (response) => {
        console.log('Per-request response interceptor:', response);
        // Transform response data
        if (response.data.success) {
          response.data.transformedMessage = 'Login successful (transformed)!';
        }
        return response;
      },
    },
  },
);
```

#### Storage Options

```typescript
// LocalStorage
const authClient = createReAuthClient({
  baseURL: 'http://localhost:3001',
  auth: {
    type: 'localstorage',
    key: 'reauth-token',
  },
});

// SessionStorage
const authClient = createReAuthClient({
  baseURL: 'http://localhost:3001',
  auth: {
    type: 'sessionstorage',
    key: 'reauth-token',
  },
});

// Cookie-based (automatic)
const authClient = createReAuthClient({
  baseURL: 'http://localhost:3001',
  auth: {
    type: 'cookie',
  },
});

// Custom token management
const authClient = createReAuthClient({
  baseURL: 'http://localhost:3001',
  auth: {
    type: 'custom',
    getToken: () => {
      // Your custom token retrieval logic
      return getTokenFromSecureStorage();
    },
  },
});
```

## 🧪 Testing the Client

### 1. Start the Backend

```bash
cd ../hono-test
pnpm dev
```

### 2. Start the Client

```bash
pnpm dev
```

### 3. Navigate to Test Page

Open `http://localhost:3000/test-client` to see the authentication interface.

### 4. Test Authentication Flow

1. Enter email and password
2. Click "Register" to create a new account
3. Click "Login" to authenticate
4. Use "Check Session" to verify authentication status

## 📁 Project Structure

```
apps/web/
├── app/
│   ├── page.tsx                 # Main application page
│   ├── test-client/
│   │   └── page.tsx            # Authentication test interface
│   └── layout.tsx              # Application layout
├── lib/
│   ├── reauth-client/          # Generated ReAuth client SDK
│   │   ├── index.ts           # Main client factory
│   │   ├── schemas.ts         # Generated type definitions
│   │   └── plugins/           # Plugin-specific endpoints
│   │       ├── email.ts       # Email authentication
│   │       ├── phone.ts       # Phone authentication
│   │       └── session.ts     # Session management
│   └── tt.ts                  # Utility functions
└── package.json               # Dependencies and scripts
```

## 🔧 SDK Generation

The client SDK is generated from the ReAuth backend introspection:

```bash
# Generate SDK from running backend
pnpm generate:sdk
```

This command:

1. Calls the backend introspection endpoint
2. Generates TypeScript types and client methods
3. Creates plugin-specific endpoint wrappers
4. Provides type-safe API integration

## 🏛️ Architecture Benefits

This example demonstrates key client-side benefits:

1. **Type Safety**: Generated SDK provides full TypeScript support
2. **Protocol Abstraction**: Client doesn't need to know about ReAuth's internal architecture
3. **Flexible HTTP Clients**: Works with any Axios configuration or instance
4. **Multiple Auth Strategies**: Supports various token storage mechanisms
5. **Interceptor Support**: Global and per-request interceptors for customization
6. **Error Handling**: Comprehensive error handling with custom callbacks

## 📝 Key Files

- `app/test-client/page.tsx` - Authentication test interface
- `lib/reauth-client/index.ts` - Main client SDK factory
- `lib/reauth-client/plugins/` - Plugin-specific endpoint implementations
- `package.json` - Dependencies and SDK generation scripts

## 🔗 Related Documentation

- [ReAuth Core Documentation](../../packages/reauth/README.md)
- [HTTP Adapters Documentation](../../packages/http-adapters/README.md)
- [SDK Generator Documentation](../../packages/sdk-generator/README.md)
- [Hono Backend Example](../hono-test/README.md)
- [Next.js Documentation](https://nextjs.org/docs)
