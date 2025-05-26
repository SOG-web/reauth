import emailPasswordAuth from './email-password/email-password.plugin';
import passwordlessAuth from './passwordless/passwordless.plugin';
import adminPlugin from './admin/admin.plugin';

export * from './email-password/email-password.plugin';
export * from './passwordless/passwordless.plugin';
export * from './admin';

export { emailPasswordAuth, passwordlessAuth, adminPlugin };
