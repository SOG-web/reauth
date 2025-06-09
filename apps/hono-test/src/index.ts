import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import type {
  AuthOutput,
  AuthPlugin,
  AuthToken,
  Entity,
} from '@re-auth/reauth';
import { showRoutes } from 'hono/dev';
import reAuth from './reauth/auth';
import { createHonoAdapter } from '@re-auth/http-adapters/adapters/hono/index';

const app = new Hono();

// Set the introspection auth key for testing
process.env.REAUTH_INTROSPECTION_KEY = 'test-key-123';

const authAdapter = createHonoAdapter(reAuth, {
  cookieName: 'reauth_session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
});

app.route('/', authAdapter.getApp());

app.get('/', (c) => {
  const entity = c.get('entity');
  return c.json({ message: 'Hello Hono!', entity });
});

// Test introspection endpoint
app.get('/test-introspection', async (c) => {
  try {
    // Call the introspection method directly on the engine
    const introspectionData = reAuth.getIntrospectionData();
    return c.json({
      message: 'Introspection data retrieved successfully',
      data: introspectionData,
    });
  } catch (error) {
    console.error('Introspection test error:', error);
    return c.json(
      {
        error: 'Failed to get introspection data',
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

showRoutes(app, {
  verbose: true,
});

serve(
  {
    fetch: app.fetch,
    port: 3001,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);

declare module 'hono' {
  interface ContextVariableMap {
    entity: Entity | null;
    token: AuthToken | null;
  }
}
