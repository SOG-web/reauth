import type { AuthPluginV2, OrmLike } from '../../types.v2';
import type { PasswordlessConfigV2 } from './types';
export type { PasswordlessConfigV2 } from './types';
import { sendMagicLinkStep } from './steps/send-magic-link.step';
import { verifyMagicLinkStep } from './steps/verify-magic-link.step';
import { registerWebAuthnStep } from './steps/register-webauthn.step';
import { authenticateWebAuthnStep } from './steps/authenticate-webauthn.step';
import { listCredentialsStep } from './steps/list-credentials.step';
import { revokeCredentialStep } from './steps/revoke-credential.step';
import { createAuthPluginV2 } from '../../utils/create-plugin.v2';
import { cleanupExpiredMagicLinks } from './utils';

export const basePasswordlessPluginV2: AuthPluginV2<PasswordlessConfigV2> = {
  name: 'passwordless',
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
    sessionTtlSeconds: 3600,
    magicLinkTtlMinutes: 30,
    magicLinks: false,
    webauthn: false,
  },
  steps: [
    sendMagicLinkStep,
    verifyMagicLinkStep,
    registerWebAuthnStep,
    authenticateWebAuthnStep,
    listCredentialsStep,
    revokeCredentialStep,
  ],
  rootHooks: {
    // Opportunistic cleanup for expired magic links (acts as a soft TTL)
    async before(_input, ctx) {
      try {
        const orm = await ctx.engine.getOrm();
        await cleanupExpiredMagicLinks(orm);
      } catch (_) {
        // Best effort cleanup; never block auth flows
      }
    },
  },
};

// Export a configured plugin creator that validates config at construction time
const passwordlessPluginV2: AuthPluginV2<PasswordlessConfigV2> = createAuthPluginV2<PasswordlessConfigV2>(
  basePasswordlessPluginV2,
  {
    validateConfig: (config) => {
      const errs: string[] = [];
      
      // At least one authentication method must be enabled
      if (!config.magicLinks && !config.webauthn) {
        errs.push(
          'At least one authentication method must be enabled. Set magicLinks: true or webauthn: true.',
        );
      }
      
      // Magic links validation
      if (config.magicLinks && typeof (config as any).sendMagicLink !== 'function') {
        errs.push(
          "magicLinks is true but 'sendMagicLink' function is not provided. Supply sendMagicLink(email, token, subject) in plugin config.",
        );
      }
      
      // WebAuthn validation
      if (config.webauthn) {
        if (!config.rpId || typeof config.rpId !== 'string') {
          errs.push(
            "webauthn is true but 'rpId' is not provided. Supply rpId (Relying Party ID/domain) in plugin config.",
          );
        }
        if (!config.rpName || typeof config.rpName !== 'string') {
          errs.push(
            "webauthn is true but 'rpName' is not provided. Supply rpName (Relying Party Name) in plugin config.",
          );
        }
      }
      
      // TTL validations
      if (config.sessionTtlSeconds && (config.sessionTtlSeconds <= 0 || config.sessionTtlSeconds > 86400 * 30)) {
        errs.push('sessionTtlSeconds must be between 1 and 2,592,000 (30 days)');
      }
      
      if (config.magicLinkTtlMinutes && (config.magicLinkTtlMinutes <= 0 || config.magicLinkTtlMinutes > 1440)) {
        errs.push('magicLinkTtlMinutes must be between 1 and 1440 (24 hours)');
      }
      
      return errs.length ? errs : null;
    },
  },
);

export default passwordlessPluginV2;