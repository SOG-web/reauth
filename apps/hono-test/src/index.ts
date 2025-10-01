import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { Hono } from 'hono';
import { showRoutes } from 'hono/dev';
import reAuth, { client } from './reauth/auth';
import { honoReAuth } from '@re-auth/http-adapters';
import { runMigrations } from './mi';
import { ConnInfo } from 'hono/conninfo';

const app = new Hono();

// Set the introspection auth key for testing
process.env.REAUTH_INTROSPECTION_KEY = 'test-key-123';

app.use('*', async (c, next) => {
  const info = getConnInfo(c);
  c.set('connInfo', info);
  await next();
});

const authAdapter = honoReAuth(
  {
    engine: reAuth,
  },
  async (c) => {
    return {
      ip: c.get('connInfo')?.remote.address,
      connInfo: c.get('connInfo'),
      userAgent: c.req.header('User-Agent'),
      trusted: c.get('connInfo')?.remote.address,
    };
  },
);

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

declare module 'hono' {
  interface ContextVariableMap {
    // Lightweight context variables - no heavy objects attached
    connInfo: ConnInfo;
  }
}

runMigrations(client);
