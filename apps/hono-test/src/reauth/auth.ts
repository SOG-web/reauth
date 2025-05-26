import { createReAuthEngine } from '@re-auth/reauth';
import { emailPasswordAuth } from '@re-auth/reauth/plugins';
import {
  KnexEntityService,
  KnexSessionService,
} from '@re-auth/reauth/services';
import { db } from '..';

const entity = new KnexEntityService(db, 'entities');
const session = new KnexSessionService(db, 'sessions');

const reAuth = createReAuthEngine({
  plugins: [
    emailPasswordAuth({
      config: {
        verifyEmail: true,
        sendCode: async (entity, code, email, type) => {},
      },
    }),
  ],
  entity,
  session,
});

export default reAuth;
