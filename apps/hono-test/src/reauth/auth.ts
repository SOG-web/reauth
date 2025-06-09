import { createReAuthEngine } from '@re-auth/reauth';
import { emailPasswordAuth, phonePasswordAuth } from '@re-auth/reauth/plugins';
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
    phonePasswordAuth({
      verifyPhone: true,
      sendCode: async (entity, code, phone) => {
        console.log('sendCode', entity, code, phone);
      },
    }),
  ],
  entity,
  session,
});

export default reAuth;
