# Fastify Adapter for ReAuth

This package provides seamless integration between ReAuth and Fastify applications.

## Features

- Automatic route generation for authentication steps
- Cookie-based session management
- Type-safe request handling
- Support for protected routes
- Customizable configuration
- Built-in request validation

## Installation

```bash
pnpm add @reauth/http-adapters fastify @re-auth/reauth
```

## Basic Usage

```typescript
import Fastify from 'fastify';
import { createFastifyAdapter } from '@reauth/http-adapters/fastify';
import { reauth } from '@re-auth/reauth';

// Initialize Fastify
const app = Fastify({ logger: true });

// Initialize ReAuth
const auth = reauth({
  // Your ReAuth configuration
});

// Register auth plugin
app.register(createFastifyAdapter(auth), {
  prefix: '/auth', // Base path for auth routes (default: '/auth')
  cookieName: 'auth_token', // Cookie name for storing auth token
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
});

// Protected route example
app.get('/profile', {
  preValidation: [app.authenticate],
  handler: (request, reply) => {
    const user = request.user; // Get authenticated user
    reply.send({ user });
  },
});

// Start server
app.listen({ port: 3000 }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log('Server running on http://localhost:3000');
});
```

## API Reference

### `createFastifyAdapter(engine: ReAuthEngine, config?: FastifyAdapterConfig)`

Creates a Fastify plugin with authentication routes.

#### Parameters

- `engine`: Instance of ReAuthEngine
- `config`: Optional configuration object
  - `prefix`: Base path for auth routes (default: '/auth')
  - `cookieName`: Name of the auth cookie (default: 'auth_token')
  - `cookieOptions`: Cookie options (default: { httpOnly: true, secure: true in production, sameSite: 'lax' })

### Request Decorators

The adapter adds the following decorators to the Fastify request object:

- `request.user`: The authenticated user entity
- `request.token`: The authentication token
- `request.isAuthenticated`: Boolean indicating if the request is authenticated
- `request.login(user)`: Log in a user
- `request.logout()`: Log out the current user

## Protected Routes

You can protect routes using the `preValidation` hook:

```typescript
// Protected route example
app.get('/dashboard', {
  preValidation: [app.authenticate],
  handler: (request, reply) => {
    reply.send({ message: 'Welcome to your dashboard' });
  },
});

// Or with role-based access
app.get('/admin', {
  preValidation: [
    app.authenticate,
    (request, reply, done) => {
      if (request.user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      done();
    },
  ],
  handler: (request, reply) => {
    reply.send({ message: 'Admin dashboard' });
  },
});
```

## Error Handling

The adapter handles common errors and returns appropriate HTTP responses:

- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `500 Internal Server Error`: Server error

### Custom Error Handling

You can customize error handling using Fastify's error handling:

```typescript
app.setErrorHandler((error, request, reply) => {
  if (error.validation) {
    return reply.status(400).send({
      error: 'Validation Error',
      details: error.validation,
    });
  }
  
  if (error.statusCode === 401) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  
  // Log error
  request.log.error(error);
  
  // Send error response
  reply.status(500).send({ error: 'Internal Server Error' });
});
```

## License

MIT
