import type { AuthPluginV2, OrmLike } from '../../types.v2';
import type { TwoFactorAuthConfigV2 } from './types';
import { setup2faStep } from './steps/setup-2fa.step';
import { verify2faStep } from './steps/verify-2fa.step';
import { disable2faStep } from './steps/disable-2fa.step';
import { generateBackupCodesStep } from './steps/generate-backup-codes.step';
import { listMethodsStep } from './steps/list-methods.step';
import { send2faCodeStep } from './steps/send-2fa-code.step';
import { cleanup2faData } from './utils/cleanup';

export type { TwoFactorAuthConfigV2 } from './types';
export { twoFactorAuthSchema } from './schema.v2';

/**
 * Two-Factor Authentication Plugin V2
 * 
 * Provides comprehensive 2FA support including:
 * - TOTP (Time-based One-Time Passwords) via authenticator apps
 * - SMS-based verification codes
 * - Email-based verification codes  
 * - Backup codes for account recovery
 * - Hardware token support (WebAuthn/FIDO2)
 * - Rate limiting and security controls
 * - Background cleanup of expired data
 */
export const baseTwoFactorAuthPluginV2: AuthPluginV2<TwoFactorAuthConfigV2> = {
  name: 'two-factor-auth',
  
  initialize(engine) {
    // Register session resolver for subjects (reuse existing resolver if available)
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
        return subject; // subjects table has no sensitive fields by default
      },
    });

    // Register background cleanup task for expired 2FA data
    const config = this.config || {};
    if (config.cleanup?.enabled !== false) {
      const cleanupIntervalMs = (config.cleanup?.intervalMinutes || 60) * 60 * 1000; // Default 1 hour

      engine.registerCleanupTask({
        name: 'expired-2fa-data',
        pluginName: 'two-factor-auth',
        intervalMs: cleanupIntervalMs,
        enabled: true,
        runner: async (orm, pluginConfig) => {
          try {
            const result = await cleanup2faData(orm, pluginConfig || config);
            return {
              cleaned: result.cleaned,
              codesDeleted: result.codesDeleted,
              backupCodesDeleted: result.backupCodesDeleted,
              failedAttemptsDeleted: result.failedAttemptsDeleted,
              errors: result.errors,
            };
          } catch (error) {
            return {
              cleaned: 0,
              errors: [`2FA cleanup failed: ${error instanceof Error ? error.message : String(error)}`],
            };
          }
        },
      });
    }
  },

  // Default configuration
  config: {
    // TOTP Configuration
    totp: {
      enabled: true,
      issuer: 'ReAuth',
      algorithm: 'SHA1' as const,
      digits: 6 as const,
      period: 30,
      window: 1,
    },

    // SMS Configuration (disabled by default - requires setup)
    sms: {
      enabled: false,
      sendCode: async (phone: string, code: string, userId: string) => {
        throw new Error('SMS send function not configured. Please provide a sendCode implementation.');
      },
      codeLength: 6,
      expiryMinutes: 10,
      rateLimit: {
        maxAttempts: 3,
        windowMinutes: 60,
      },
    },

    // Email Configuration (disabled by default - requires setup)  
    email: {
      enabled: false,
      codeLength: 6,
      expiryMinutes: 10,
      sendCode: async (email: string, code: string, userId: string) => {
        throw new Error('Email send function not configured. Please provide a sendCode implementation.');
      },
    },

    // Backup Codes
    backupCodes: {
      enabled: true,
      count: 10,
      length: 8,
    },

    // Hardware Tokens (disabled by default - requires WebAuthn setup)
    hardwareTokens: {
      enabled: false,
      allowedCredentialTypes: ['public-key'],
    },

    // Security Settings
    security: {
      requireForLogin: false, // If true, 2FA is mandatory for login
      requireForSensitiveActions: true, // Require 2FA for sensitive actions like disabling 2FA
      maxFailedAttempts: 5,
      lockoutDurationMinutes: 30,
    },

    // Cleanup Configuration
    cleanup: {
      enabled: true,
      intervalMinutes: 60, // Run cleanup every hour
      expiredCodeRetentionHours: 24, // Keep expired codes for 24 hours
      failedAttemptRetentionDays: 7, // Keep failed attempt records for 7 days
    },

    // Session settings
    sessionTtlSeconds: 3600, // 1 hour
  },

  // All available steps
  steps: [
    setup2faStep,
    verify2faStep,
    disable2faStep,
    generateBackupCodesStep,
    listMethodsStep,
    send2faCodeStep,
  ],

  // Define sensitive fields that should be encrypted/protected
  getSensitiveFields() {
    return [
      'secretEncrypted',
      'phoneNumberEncrypted', 
      'emailEncrypted',
      'codeHash',
      'publicKey',
    ];
  },
};

// Export the plugin as default
export default baseTwoFactorAuthPluginV2;