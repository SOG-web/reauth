# Hono Adapter for ReAuth

This package provides seamless integration between ReAuth and Hono.js applications.

## Features

- Automatic route generation for authentication steps
- Cookie-based session management
- Type-safe request handling
- Support for protected routes
- Customizable configuration

## Installation

```bash
pnpm add @re-auth/http-adapters hono @re-auth/reauth
```

## Basic Usage

```typescript
import { Hono } from 'hono';
// Start server (example with Node.js)
import { serve } from '@hono/node-server';
import { createHonoAuth } from '@re-auth/http-adapters/hono';
import { reauth } from '@re-auth/reauth';

// Initialize ReAuth
const auth = reauth({
  // Your ReAuth configuration
});

// Create Hono app
const app = new Hono();

// Initialize Hono auth adapter
const authRouter = createHonoAuth(auth, {
  basePath: '/auth', // Base path for auth routes (default: '/auth')
  cookieName: 'auth_token', // Cookie name for storing auth token
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
});

// Mount auth routes
app.route('', authRouter);

// Protected route example
app.get('/profile', (c) => {
  const user = c.get('entity'); // Get authenticated user
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return c.json({ user });
});

serve({
  fetch: app.fetch,
  port: 3000,
});
```

## Usage with main app

```typescript
import { Hono } from 'hono';
// Start server (example with Node.js)
import { serve } from '@hono/node-server';
import { createHonoAuth } from '@re-auth/http-adapters/hono';
import { reauth } from '@re-auth/reauth';

// Initialize ReAuth
const auth = reauth({
  // Your ReAuth configuration
});

// Create Hono app
const app = new Hono();

// Initialize Hono auth adapter
const authAdapter = createHonoAuth(auth);
const authApp = authAdapter.getHonoApp();

// Mount auth routes
app.route('/auth', authApp);

// Protected route example
app.get('/protected', authAdapter.protect(), async (c) => {
  const user = authAdapter.getCurrentUser(c);
  return c.json({ message: 'Welcome to protected route!', user });
});

// Role-based protection
app.get('/admin', authAdapter.protect({ roles: ['admin'] }), async (c) => {
  return c.json({ message: 'Admin only area' });
});

// Custom authorization
app.get(
  '/profile/:id',
  authAdapter.protect({
    authorize: async (entity, token, c) => {
      const profileId = c.req.param('id');
      return entity.id === profileId || entity.role === 'admin';
    },
  }),
  async (c) => {
    return c.json({ message: 'Profile access granted' });
  },
);

// Start server

serve({
  fetch: app.fetch,
  port: 3000,
});
```

## API Reference

### `createHonoAuth(engine: ReAuthEngine, config?: HonoAuthConfig): Hono`

Creates a new Hono application with authentication routes.

#### Parameters

- `engine`: An instance of ReAuthEngine
- `config`: Optional configuration object (see below)

#### Returns

A Hono application instance with authentication routes mounted under the configured base path.

### `protect(options?: ProtectOptions)`

Middleware to protect routes. Can be used to require authentication and optionally check for specific roles.

#### Parameters

- `options` (object, optional):
  - `roles` (string[]): Array of allowed role names
  - `authorize` (function): Custom authorization function that receives the entity and context

#### Returns

A Hono middleware function that enforces the protection rules.

### `HonoAuthConfig`

Configuration options for the Hono adapter:

- `basePath` (string, default: `'/auth'`): Base path for all auth routes
- `cookieName` (string, default: `'auth_token'`): Name of the auth cookie
- `cookieOptions` (object): Cookie options
  - `httpOnly` (boolean, default: `true`)
  - `secure` (boolean, default: `process.env.NODE_ENV === 'production'`)
  - `sameSite` (string, default: `'lax'`)
  - `maxAge` (number, default: 604800 - 7 days in seconds)
  - `domain` (string, optional)
  - `path` (string, optional)

### Context Variables

The adapter adds the following variables to the Hono context:

- `c.get('entity')`: The authenticated user entity (or null if not authenticated)
- `c.get('token')`: The authentication token (or null if not authenticated)
- `c.get('authenticated')`: Boolean indicating if the request is authenticated

## Protected Routes

You can protect routes using the `protect` middleware:

```typescript
// Protected route example
app.get('/dashboard', (c) => {
  if (!c.get('authenticated')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return c.json({ message: 'Welcome to your dashboard' });
});
```

## Error Handling

The adapter handles common errors and returns appropriate HTTP responses:

- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `500 Internal Server Error`: Server error

## Customization

### Custom Error Handling

You can customize error handling by adding your own error middleware:

```typescript
app.onError((err, c) => {
  if (err instanceof InputValidationError) {
    return c.json({ error: err.message }, 400);
  }
  // Handle other errors
  return c.json({ error: 'Internal Server Error' }, 500);
});
```

## License

MIT
