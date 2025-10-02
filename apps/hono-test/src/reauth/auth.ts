import createReAuthEngine, {
  buildSchema,
  OrmLike,
  reauthDbVersions,
  extendSchemaVersion,
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
import { usernamePasswordSchema } from '@re-auth/reauth/plugins/username';
import { anonymousSchema } from '@re-auth/reauth/plugins/anonymous';
import { phonePasswordSchema } from '@re-auth/reauth/plugins/phone';
import { apiKeySchema } from '@re-auth/reauth/plugins/api-key';

export const kysely = new Kysely({
  dialect: new SqliteDialect({
    database: new SQLite('./db.sqlite'),
  }),
});

// ============================================================
// SCHEMA VERSIONING EXAMPLES
// ============================================================

// Version 1.0.1 - Base schema with core authentication
const { schema: v1, plugins: v1Plugins } = reauthDb('1.0.1', [
  emailPasswordSchema,
  jwtSchema,
  sessionSchema,
]);

// Version 1.0.2 - Extended from v1 using the helper function
// This is the recommended way to create new versions
const { schema: v2, plugins: v2Plugins } = extendSchemaVersion(
  v1Plugins,
  '1.0.2',
  [usernamePasswordSchema, anonymousSchema, phonePasswordSchema],
);

// You can continue extending versions:
// const v3 = extendSchemaVersion(v2, '1.0.3', [apiKeySchema]);

// Old way (still works, but requires repeating all schemas):
// const v2 = buildSchema('1.0.2', [
//   emailPasswordSchema,
//   jwtSchema,
//   sessionSchema,
//   usernamePasswordSchema,
//   anonymousSchema,
//   phonePasswordSchema,
// ]);

const { schema: v3, plugins: v3Plugins } = extendSchemaVersion(
  v2Plugins,
  '1.0.3',
  [apiKeySchema],
);

export const factory = reauthDbVersions([v1, v2, v3]);

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
    // {
    //   type: 'after',
    //   universal: true,
    //   fn: async (
    //     data: AuthInput | AuthOutput,
    //     container: ReAuthCradle,
    //     error?: unknown,
    //   ) => {
    //     return {
    //       ...data,
    //       others: {
    //         ...data.others,
    //         test: 'test',
    //       },
    //     };
    //   },
    // },
    // {
    //   type: 'before',
    //   universal: true,
    //   fn: async (
    //     data: AuthInput | AuthOutput,
    //     container: ReAuthCradle,
    //     error?: unknown,
    //   ) => {
    //     console.log(data);
    //     const ses = await container
    //       .resolve('engine')
    //       .checkSession(data.token ?? '');
    //     console.log(ses);
    //     return {
    //       ...data,
    //       others: {
    //         ...data.others,
    //         test: 'test',
    //       },
    //     };
    //   },
    // },
  ],
  enableCleanupScheduler: true,
  getUserData: async (subjectId, orm) => {
    return { id: subjectId };
  },
  deviceValidator: async (storedDeviceInfo, currentDeviceInfo) => {
    // Example: allow access if IP addresses match or if it's a trusted device
    return Promise.resolve(
      storedDeviceInfo.ip === currentDeviceInfo.ip ||
        storedDeviceInfo.trusted === true,
    );
  },
});
