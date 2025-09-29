import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { showRoutes } from 'hono/dev';
import reAuth, { client } from './reauth/auth';
import { honoReAuth } from '@re-auth/http-adapters';
import { runMigrations } from './mi';

const app = new Hono();

// Set the introspection auth key for testing
process.env.REAUTH_INTROSPECTION_KEY = 'test-key-123';

const authAdapter = honoReAuth({
  engine: reAuth,
});

authAdapter.registerRoutes(app, '/auth', true);

app.use('/', authAdapter.createUserMiddleware());

app.get('/', (c) => {
  const user = c.get('user');
  return c.json({ message: 'Hello Hono!', user });
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

//runMigrations(client);
