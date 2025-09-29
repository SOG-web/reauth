import createReAuthEngine, {
  AuthInput,
  AuthOutput,
  OrmLike,
  ReAuthCradle,
  reauthDb,
} from '@re-auth/reauth';
import { kyselyAdapter } from 'fumadb/adapters/kysely';
import SQLite from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import emailPasswordPlugin, {
  emailPasswordSchema,
} from '@re-auth/reauth/plugins/email-password';
import jwtPlugin from '@re-auth/reauth/plugins/jwt';
import { jwtSchema } from '@re-auth/reauth/services';
import sessionPlugin, { sessionSchema } from '@re-auth/reauth/plugins/session';

export const kysely = new Kysely({
  dialect: new SqliteDialect({
    database: new SQLite('./db.sqlite'),
  }),
});

export const factory = reauthDb('1.0.1', [
  emailPasswordSchema,
  jwtSchema,
  sessionSchema,
]);

export const client = factory.client(
  kyselyAdapter({
    provider: 'sqlite',
    db: kysely, // kysely instance
  }),
);

export default createReAuthEngine({
  dbClient: {
    version: async () => await client.version(),
    orm: (version: any) => {
      const orm = client.orm(version);
      return orm as OrmLike;
    },
  },
  plugins: [
    sessionPlugin({}),
    emailPasswordPlugin({
      sendCode(subject, code, email, type) {
        console.log(subject, code, email, type);
        return Promise.resolve();
      },
      verifyEmail: true,
    }),
    jwtPlugin({
      issuer: 'https://example.com',
      keyRotationIntervalDays: 30,
      keyGracePeriodDays: 7,
      defaultAccessTokenTtlSeconds: 3600,
      defaultRefreshTokenTtlSeconds: 86400,
      enableRefreshTokenRotation: true,
    }),
  ],
  authHooks: [
    {
      type: 'after',
      universal: true,
      fn: async (
        data: AuthInput | AuthOutput,
        container: ReAuthCradle,
        error?: unknown,
      ) => {
        return {
          ...data,
          others: {
            ...data.others,
            test: 'test',
          },
        };
      },
    },
    {
      type: 'before',
      universal: true,
      fn: async (
        data: AuthInput | AuthOutput,
        container: ReAuthCradle,
        error?: unknown,
      ) => {
        console.log(data);

        const ses = await container
          .resolve('engine')
          .checkSession(data.token ?? '');
        console.log(ses);
        return {
          ...data,
          others: {
            ...data.others,
            test: 'test',
          },
        };
      },
    },
  ],
  enableCleanupScheduler: true,
  getUserData: async (subjectId, orm) => {
    return { id: subjectId };
  },
});
