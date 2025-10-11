import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { Hono } from 'hono';
import { showRoutes } from 'hono/dev';
import reAuth from './reauth/auth';
import { honoReAuth } from '@re-auth/http-adapters';
import { createDefaultLogger } from '@re-auth/logger';
import { ConnInfo } from 'hono/conninfo';

const app = new Hono();

// Set the introspection auth key for testing
process.env.REAUTH_INTROSPECTION_KEY = 'test-key-123';

// Create logger instance for HTTP adapter
const httpLogger = createDefaultLogger({
  prefix: 'HonoTest-HTTP',
  prefixEnv: 'REAUTH_',
  enabledTags: ['http', 'auth', 'session'],
  timestampFormat: 'human',
  emojis: true,
});

app.use('*', async (c, next) => {
  const info = getConnInfo(c);
  c.set('connInfo', info);
  await next();
});

// reAuth.executeStep('email-password', 'login', {
//   email: '',
//   password: '',
// });

// const td2 = reAuth.getPlugin('session')?.steps[3]?.outputs?.toJsonSchema();
// console.log('td2', td2);

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
  httpLogger, // Pass logger to HTTP adapter
);

authAdapter.registerRoutes(app, '/auth', true);

app.use('/', authAdapter.createUserMiddleware());

app.get('/', (c) => {
  const user = c.get('user');
  const td1 = reAuth.getPlugin('session')?.steps[0]?.outputs?.toJsonSchema();
  httpLogger.info('http', 'Session schema requested', { schema: td1 });
  return c.json({ message: 'Hello Hono!', user, td1 });
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
    httpLogger.info(
      'http',
      `Server is running on http://localhost:${info.port}`,
    );
  },
);

declare module 'hono' {
  interface ContextVariableMap {
    // Lightweight context variables - no heavy objects attached
    connInfo: ConnInfo;
  }
}
