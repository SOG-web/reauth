import type { AuthPluginV2, OrmLike } from '../../types.v2';
import type { UsernamePasswordConfigV2 } from './types';
export type { UsernamePasswordConfigV2 } from './types';
import { loginStep } from './steps/login.step';
import { registerStep } from './steps/register.step';
import { changePasswordStep } from './steps/change-password.step';
import { createAuthPluginV2 } from '../../utils/create-plugin.v2';

export const baseUsernamePasswordPluginV2: AuthPluginV2<UsernamePasswordConfigV2> = {
  name: 'username-password',
  initialize(engine) {
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
    loginOnRegister: true,
    sessionTtlSeconds: 3600,
    // Username has no verification flow by design
    enableResetByUsername: false,
    resetPasswordCodeExpiresIn: 30 * 60 * 1000,
    codeType: 'numeric',
    codeLength: 4,
  },
  steps: [
    loginStep,
    registerStep,
    changePasswordStep,
    // Note: No verification steps since username doesn't require verification
    // Optional: Add reset steps if enableResetByUsername is implemented in the future
  ],
  rootHooks: {
    // Minimal cleanup for reset codes (if reset by username is implemented)
    async before(_input, ctx) {
      try {
        const orm = await ctx.engine.getOrm();
        const now = new Date();
        // Remove expired reset codes (if any)
        await orm.updateMany('username_identities', {
          where: (b: any) =>
            b.and(
              b('reset_code_expires_at', '!=', null),
              b('reset_code_expires_at', '<', now),
            ),
          data: {
            reset_code: null,
            reset_code_expires_at: null,
          },
        });
      } catch (_) {
        // Best effort cleanup; never block auth flows
      }
    },
  },
};

// Export a configured plugin creator with minimal validation (no complex config validation needed)
const usernamePasswordPluginV2: AuthPluginV2<UsernamePasswordConfigV2> = createAuthPluginV2<UsernamePasswordConfigV2>(
  baseUsernamePasswordPluginV2,
  {
    validateConfig: (_config) => {
      // Username plugin has minimal config validation requirements
      // Future: Add validation for enableResetByUsername if implemented
      return null;
    },
  },
);

export default usernamePasswordPluginV2;