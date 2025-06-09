# Express Adapter for ReAuth

This package provides seamless integration between ReAuth and Express.js applications.

## Features

- Automatic route generation for authentication steps
- Cookie-based session management
- Type-safe request handling
- Support for protected routes
- Customizable configuration

## Installation

```bash
pnpm add @reauth/http-adapters express @re-auth/reauth
```

## Basic Usage

```typescript
import express from 'express';
import { createExpressAdapter } from '@reauth/http-adapters/express';
import { reauth } from '@re-auth/reauth';

// Initialize Express app
const app = express();

// Initialize ReAuth
const auth = reauth({
  // Your ReAuth configuration
});

// Add middleware
app.use(express.json());

// Mount auth routes
app.use(
  '/auth',
  createExpressAdapter(auth, {
    cookieName: 'auth_token',
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  }),
);

// Protected route example
app.get('/profile', (req, res) => {
  const user = req.user; // Get authenticated user
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ user });
});

// Start server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

## API Reference

### `createExpressAdapter(engine: ReAuthEngine, config?: ExpressAdapterConfig)`

Creates an Express middleware with authentication routes.

#### Parameters

- `engine`: Instance of ReAuthEngine
- `config`: Optional configuration object
  - `path`: Base path for auth routes (default: '/auth')
  - `cookieName`: Name of the auth cookie (default: 'auth_token')
  - `cookieOptions`: Cookie options (default: { httpOnly: true, secure: true in production, sameSite: 'lax' })

### Request Extensions

The adapter extends Express's request object with:

- `req.user`: The authenticated user entity
- `req.token`: The authentication token
- `req.isAuthenticated()`: Method that returns true if the request is authenticated

## Protected Routes

You can protect routes using the request extensions:

```typescript
// Protected route example
app.get('/dashboard', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ message: 'Welcome to your dashboard' });
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
app.use((err, req, res, next) => {
  if (err.name === 'InputValidationError') {
    return res.status(400).json({ error: err.message });
  }
  // Handle other errors
  res.status(500).json({ error: 'Internal Server Error' });
});
```

## License

MIT
