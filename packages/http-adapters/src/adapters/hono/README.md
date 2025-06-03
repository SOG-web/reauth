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
pnpm add @reauth/http-adapters hono @re-auth/reauth
```

## Basic Usage

```typescript
import { Hono } from 'hono';
import { createHonoAuth } from '@reauth/http-adapters/hono';
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

// Start server
app.fire();
```

## Usage with main app

```typescript
import { Hono } from 'hono';
import { createHonoAuth } from '@reauth/http-adapters/hono';
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
app.fire();
```

## API Reference

### `createHonoAuth(engine: ReAuthEngine, config?: HonoAuthConfig)`

Creates a Hono router with authentication routes.

#### Parameters

- `engine`: Instance of ReAuthEngine
- `config`: Optional configuration object
  - `basePath`: Base path for auth routes (default: '/auth')
  - `cookieName`: Name of the auth cookie (default: 'auth_token')
  - `cookieOptions`: Cookie options (default: { httpOnly: true, secure: true in production, sameSite: 'lax' })

### Context Extensions

The adapter extends Hono's context with:

- `c.get('entity')`: The authenticated user entity
- `c.get('token')`: The authentication token
- `c.get('authenticated')`: Boolean indicating if the request is authenticated

## Protected Routes

You can protect routes using the context extensions:

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
