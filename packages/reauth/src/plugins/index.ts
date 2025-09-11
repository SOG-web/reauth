import emailPasswordAuth from './email-password/email-password.plugin';
import phonePasswordAuth from './phone-password/phone-password.plugin';
// import passwordlessAuth from './passwordless/passwordless.plugin';
import adminPlugin from './admin/admin.plugin';
import usernamePasswordAuth from './username/username.plugin';
import apiKeyAuth from './api-key/api-key.plugin';
import anonymousAuth from './anonymous/anonymous.plugin';
import sessionPlugin from './session/session.plugin';

// OAuth plugins
import {
  googleOAuthPlugin,
  facebookOAuthPlugin,
  githubOAuthPlugin,
  linkedinOAuthPlugin,
} from './oauth';

export * from './email-password/email-password.plugin';
export * from './passwordless/passwordless.plugin';
export * from './admin';
export * from './oauth';

export {
  emailPasswordAuth,
  phonePasswordAuth,
  sessionPlugin,
  // passwordlessAuth,
  adminPlugin,
  usernamePasswordAuth,
  apiKeyAuth,
  anonymousAuth,
  // OAuth plugins
  googleOAuthPlugin,
  facebookOAuthPlugin,
  githubOAuthPlugin,
  linkedinOAuthPlugin,
};
