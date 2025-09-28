import type { AuthPlugin, AuthStep, OrmLike, Subject } from '../../types';
import type { EmailOrUsernameConfig } from './types';
export type { EmailOrUsernameConfig } from './types';
import { loginStep } from './steps/login.step';
import { registerStep } from './steps/register.step';
import { changePasswordStep } from './steps/change-password.step';
import { createAuthPlugin } from '../../utils/create-plugin';

export const baseEmailOrUsernamePlugin: AuthPlugin<EmailOrUsernameConfig> = {
  name: 'email-or-username',
  initialize(engine) {
    // Check that required plugins are present
    const emailPlugin = engine.getPlugin('email-password');
    const usernamePlugin = engine.getPlugin('username-password');

    if (!emailPlugin) {
      throw new Error(
        'email-or-username plugin requires the email-password plugin to be registered. ' +
          'Please add the email-password plugin to your engine configuration.',
      );
    }

    if (!usernamePlugin) {
      throw new Error(
        'email-or-username plugin requires the username plugin to be registered. ' +
          'Please add the username plugin to your engine configuration.',
      );
    }

    // Register session resolver for subjects (shared with underlying plugins)
    engine.registerSessionResolver('subject', {
      async getById(id: string, orm: OrmLike) {
        const subject = await orm.findFirst('subjects', {
          where: (b: any) => b('id', '=', id),
        });
        return (subject ?? null) as unknown as Subject | null;
      },
      sanitize(subject: any) {
        return subject; // subjects table has no sensitive fields
      },
    });
  },
  config: {
    detectionStrategy: 'auto',
    allowBothTypes: false,
    sessionTtlSeconds: 3600,
    loginOnRegister: true,
    emailConfig: {
      verifyEmail: false,
      loginOnRegister: true,
      sessionTtlSeconds: 3600,
    },
    usernameConfig: {
      loginOnRegister: true,
      sessionTtlSeconds: 3600,
    },
  },
  steps: [
    loginStep,
    registerStep,
    changePasswordStep,
    // Note: Other steps like email verification are handled by delegation
    // to the underlying email-password plugin when needed
  ],
  async getProfile(subjectId, ctx) {
    const orm = await ctx.engine.getOrm();
    // Collect email identities
    const emailIdentities = await orm.findMany('identities', {
      where: (b: any) =>
        b.and(b('subject_id', '=', subjectId), b('provider', '=', 'email')),
      orderBy: [['created_at', 'desc']],
    });

    const emails = (emailIdentities || []).map((ident: any) => ({
      email: String(ident.identifier),
      verified: Boolean(ident.verified),
      created_at: ident?.created_at
        ? ident.created_at instanceof Date
          ? ident.created_at.toISOString()
          : new Date(String(ident.created_at)).toISOString()
        : undefined,
      updated_at: ident?.updated_at
        ? ident.updated_at instanceof Date
          ? ident.updated_at.toISOString()
          : new Date(String(ident.updated_at)).toISOString()
        : undefined,
    }));

    // Collect username identities
    const usernameIdentities = await orm.findMany('identities', {
      where: (b: any) =>
        b.and(b('subject_id', '=', subjectId), b('provider', '=', 'username')),
      orderBy: [['created_at', 'desc']],
    });

    const usernames = (usernameIdentities || []).map((ident: any) => ({
      username: String(ident.identifier),
      verified: Boolean(ident.verified),
      created_at: ident?.created_at
        ? ident.created_at instanceof Date
          ? ident.created_at.toISOString()
          : new Date(String(ident.created_at)).toISOString()
        : undefined,
      updated_at: ident?.updated_at
        ? ident.updated_at instanceof Date
          ? ident.updated_at.toISOString()
          : new Date(String(ident.updated_at)).toISOString()
        : undefined,
    }));

    return { emails, usernames };
  },
  rootHooks: {
    // Delegate cleanup to underlying plugins via their SimpleCleanupScheduler integration
    async before(input, ctx, step) {
      // The underlying plugins handle their own cleanup via SimpleCleanupScheduler
      // This plugin doesn't need additional cleanup logic
    },
  },
};

// Export a factory function that creates a configured plugin
const emailOrUsernamePlugin = (
  config: Partial<EmailOrUsernameConfig>,
  overrideStep?: Array<{
    name: string;
    override: Partial<AuthStep<EmailOrUsernameConfig>>;
  }>,
): AuthPlugin<EmailOrUsernameConfig> =>
  createAuthPlugin<EmailOrUsernameConfig>(baseEmailOrUsernamePlugin, {
    config,
    stepOverrides: overrideStep,
    validateConfig: (config) => {
      const errs: string[] = [];

      // Validate email config if email verification is enabled
      if (
        config.emailConfig?.verifyEmail &&
        typeof config.emailConfig?.sendCode !== 'function'
      ) {
        errs.push(
          "emailConfig.verifyEmail is true but 'sendCode' is not provided. Supply sendCode function in emailConfig.",
        );
      }

      // Validate detection strategy
      if (
        config.detectionStrategy &&
        !['auto', 'explicit'].includes(config.detectionStrategy)
      ) {
        errs.push("detectionStrategy must be 'auto' or 'explicit'");
      }

      // Validate precedence/consistency for session TTL
      const topTTL = config.sessionTtlSeconds;
      const emailTTL = config.emailConfig?.sessionTtlSeconds;
      const userTTL = config.usernameConfig?.sessionTtlSeconds;
      for (const [label, ttl] of [
        ['sessionTtlSeconds', topTTL],
        ['emailConfig.sessionTtlSeconds', emailTTL],
        ['usernameConfig.sessionTtlSeconds', userTTL],
      ] as const) {
        if (ttl !== undefined && (!Number.isFinite(ttl) || ttl <= 0)) {
          errs.push(`${label} must be a positive finite number`);
        }
      }
      if (
        typeof topTTL === 'number' &&
        ((typeof emailTTL === 'number' && emailTTL !== topTTL) ||
          (typeof userTTL === 'number' && userTTL !== topTTL))
      ) {
        errs.push(
          'sessionTtlSeconds differs between top-level and nested configs; set it in one place or make them equal.',
        );
      }

      // Validate precedence/consistency for loginOnRegister
      const topLogin = config.loginOnRegister;
      const emailLogin = config.emailConfig?.loginOnRegister;
      const userLogin = config.usernameConfig?.loginOnRegister;
      if (
        typeof topLogin === 'boolean' &&
        ((typeof emailLogin === 'boolean' && emailLogin !== topLogin) ||
          (typeof userLogin === 'boolean' && userLogin !== topLogin))
      ) {
        errs.push(
          'loginOnRegister differs between top-level and nested configs; set it in one place or make them equal.',
        );
      }
      // Validate test users format
      if (config.testUsers?.enabled && config.testUsers.users) {
        for (const user of config.testUsers.users) {
          if (!user.email && !user.username) {
            errs.push(
              "Each test user must have either 'email' or 'username' property",
            );
          }
          if (!user.password) {
            errs.push("Each test user must have a 'password' property");
          }
        }
      }

      return errs.length ? errs : null;
    },
  });

export default emailOrUsernamePlugin;
