import createReAuthEngine, { reauthDb } from '@re-auth/reauth';
import { kyselyAdapter } from 'fumadb/adapters/kysely';
import SQLite from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import emailPasswordPlugin from '@re-auth/reauth/plugins/email-password';

export const kysely = new Kysely({
  dialect: new SqliteDialect({
    database: new SQLite('./db.sqlite'),
  }),
});

const factory = reauthDb();

const client = factory.client(
  kyselyAdapter({
    provider: 'sqlite',
    db: kysely, // kysely instance
  }),
);

export default createReAuthEngine({
  dbClient: {
    version: client.version,
    orm: (version) => client,
  },
  plugins: [
    emailPasswordPlugin({
      sendCode(subject, code, email, type) {
        console.log(subject, code, email, type);
        return Promise.resolve();
      },
    }),
  ],
  enableCleanupScheduler: true,
});
