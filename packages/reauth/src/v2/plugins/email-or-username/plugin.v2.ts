import type { AuthPluginV2, OrmLike } from '../../types.v2';
import type { EmailOrUsernameConfigV2 } from './types';
export type { EmailOrUsernameConfigV2 } from './types';
import { loginStep } from './steps/login.step';
import { registerStep } from './steps/register.step';
import { changePasswordStep } from './steps/change-password.step';
import { createAuthPluginV2 } from '../../utils/create-plugin.v2';

export const baseEmailOrUsernamePluginV2: AuthPluginV2<EmailOrUsernameConfigV2> =
  {
    name: 'email-or-username',
    initialize(engine) {
      // Check that required plugins are present
      const emailPlugin = engine.getPlugin('email-password');
      const usernamePlugin = engine.getPlugin('username');

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
          return (subject ?? null) as unknown as
            | import('../../types.v2').Subject
            | null;
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
    rootHooks: {
      // Delegate cleanup to underlying plugins via their SimpleCleanupScheduler integration
      async before(input, ctx, step) {
        // The underlying plugins handle their own cleanup via SimpleCleanupScheduler
        // This plugin doesn't need additional cleanup logic
      },
    },
  };

// Export a configured plugin creator with validation
const emailOrUsernamePluginV2: AuthPluginV2<EmailOrUsernameConfigV2> =
  createAuthPluginV2<EmailOrUsernameConfigV2>(baseEmailOrUsernamePluginV2, {
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

export default emailOrUsernamePluginV2;
