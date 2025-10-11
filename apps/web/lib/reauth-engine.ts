import createReAuthEngine, {
  reauthDb,
  extendSchemaVersion,
  reauthDbVersions,
  type OrmLike,
} from '@re-auth/reauth';
import { createDefaultLogger } from '@re-auth/logger';
import { kyselyAdapter } from 'fumadb/adapters/kysely';
import SQLite from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import emailPasswordPlugin, {
  emailPasswordSchema,
} from '@re-auth/reauth/plugins/email-password';
import usernamePlugin, {
  usernamePasswordSchema,
} from '@re-auth/reauth/plugins/username';
import sessionPlugin, { sessionSchema } from '@re-auth/reauth/plugins/session';

// Initialize SQLite database
const kysely = new Kysely({
  dialect: new SqliteDialect({
    database: new SQLite('./db.sqlite'),
  }),
});

// Create database schema versions
const { schema: v1, plugins: v1Plugins } = reauthDb('1.0.0', [
  emailPasswordSchema,
  sessionSchema,
]);

const { schema: v2, plugins: v2Plugins } = extendSchemaVersion(
  v1Plugins,
  '1.0.1',
  [usernamePasswordSchema],
);

// Create database factory and client
const factory = reauthDbVersions([v1, v2]);
const client = factory.client(
  kyselyAdapter({
    provider: 'sqlite',
    db: kysely,
  }),
);

// Create logger instance for the web app
const logger = createDefaultLogger({
  prefix: 'WebApp',
  prefixEnv: 'REAUTH_',
  enabledTags: ['auth', 'session', 'http', 'plugin'],
  timestampFormat: 'human',
  emojis: true,
});

// Create ReAuth engine
const engine = createReAuthEngine({
  dbClient: {
    version: async () => await client.version(),
    orm: (version: any) => {
      const orm = client.orm(version);
      return orm as OrmLike;
    },
  },
  logger: logger, // Required logger instance
  plugins: [
    sessionPlugin({}),
    emailPasswordPlugin({
      verifyEmail: false, // Disabled for testing
      loginOnRegister: true,
      sessionTtlSeconds: 3600, // 1 hour
      sendCode: async (subject, code, email, type) => {
        // Mock send code - in production, integrate with email service
        logger.info('email', `Sending ${type} code`, {
          code,
          email,
          subjectId: subject.id,
        });
      },
    }),
    usernamePlugin({
      loginOnRegister: true,
      sessionTtlSeconds: 3600, // 1 hour
    }),
  ],
  authHooks: [],
  sessionHooks: [],
  enableCleanupScheduler: true,
  getUserData: async (subjectId, orm) => {
    // Get user data from database
    const subject = await orm.findFirst('subjects', {
      where: (b: any) => b('id', '=', subjectId),
    });

    if (!subject) {
      throw new Error(`Subject ${subjectId} not found`);
    }

    return {
      id: subject.id,
      role: subject.role || 'user',
      ...subject,
    };
  },
});

export { engine, client, factory };
