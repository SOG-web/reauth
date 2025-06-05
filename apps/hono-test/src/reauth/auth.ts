import { createReAuthEngine } from '@re-auth/reauth';
import { emailPasswordAuth } from '@re-auth/reauth/plugins';
import {
  KnexEntityService,
  KnexSessionService,
} from '@re-auth/reauth/services';
import knex from 'knex';


export const db = knex({
  client: 'better-sqlite3',
  connection: {
    filename: './test.db',
  },
  useNullAsDefault: true,
});

const entity = new KnexEntityService(db, 'entities');
const session = new KnexSessionService(db, 'sessions');

const reAuth = createReAuthEngine({
  plugins: [
    emailPasswordAuth({
      verifyEmail: true,
      sendCode: async (entity, code, email, type) => {
        console.log('sendCode', entity, code, email, type);
      },
    }),
  ],
  entity,
  session,
});

export default reAuth;
