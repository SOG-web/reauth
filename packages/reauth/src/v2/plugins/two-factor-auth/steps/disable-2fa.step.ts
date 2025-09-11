import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { TwoFactorAuthConfigV2 } from '../types';

export interface Disable2faInput {
  userId: string;
  methodId?: string; // If provided, disable specific method; if not, disable all 2FA
  confirmationCode?: string; // Optional verification code to confirm disable action
}

export interface Disable2faOutput {
  disabled: boolean;
  methodsDisabled: number;
  message: string;
}

export const disable2faValidation = type({
  userId: 'string',
  'methodId?': 'string',
  'confirmationCode?': 'string',
});

export const disable2faStep: AuthStepV2<
  Disable2faInput,
  Disable2faOutput,
  TwoFactorAuthConfigV2
> = {
  name: 'disable-2fa',
  description: 'Disable 2FA for a user (specific method or all methods)',
  validationSchema: disable2faValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ic: 400, sn: 404, unf: 401 },
    },
  },
  inputs: ['userId', 'methodId', 'confirmationCode'],
  outputs: type({
    disabled: 'boolean',
    methodsDisabled: 'number',
    message: 'string',
  }),

  async run(input, ctx) {
    const { userId, methodId, confirmationCode } = input;
    const orm = await ctx.engine.getOrm();
    const config = ctx.config;

    try {
      // If disabling all methods and sensitive action protection is enabled, verify confirmation
      if (!methodId && config.security.requireForSensitiveActions && !confirmationCode) {
        return {
          disabled: false,
          methodsDisabled: 0,
          message: 'Confirmation code required to disable all 2FA methods',
          status: 'unf',
        } as Disable2faOutput & AuthOutput;
      }

      let methodsToDisable;

      if (methodId) {
        // Disable specific method
        const method = await orm.findFirst('two_factor_methods', {
          where: (b: any) => b.and([
            b('id', '=', methodId),
            b('userId', '=', userId)
          ]),
        });

        if (!method) {
          return {
            disabled: false,
            methodsDisabled: 0,
            message: '2FA method not found',
            status: 'sn',
          } as Disable2faOutput & AuthOutput;
        }

        methodsToDisable = [method];
      } else {
        // Disable all methods for user
        methodsToDisable = await orm.findMany('two_factor_methods', {
          where: (b: any) => b('userId', '=', userId),
        });

        if (methodsToDisable.length === 0) {
          return {
            disabled: false,
            methodsDisabled: 0,
            message: 'No 2FA methods found for user',
            status: 'sn',
          } as Disable2faOutput & AuthOutput;
        }
      }

      // If confirmation code is provided for sensitive action, verify it
      if (confirmationCode && config.security.requireForSensitiveActions) {
        // This would typically verify against a recently sent confirmation code
        // For now, we'll accept any confirmation code as valid
        // In production, implement proper verification logic
      }

      // Remove the 2FA methods
      let disabledCount = 0;
      for (const method of methodsToDisable) {
        await orm.delete('two_factor_methods', {
          where: (b: any) => b('id', '=', method.id),
        });
        disabledCount++;
      }

      // Clean up related data for disabled methods
      await cleanupRelatedData(orm, userId, methodsToDisable);

      const message = methodId ? 
        `2FA method disabled successfully` : 
        `All ${disabledCount} 2FA methods disabled successfully`;

      return {
        disabled: true,
        methodsDisabled: disabledCount,
        message,
        success: true,
        status: 'su',
      } as Disable2faOutput & AuthOutput;

    } catch (error) {
      return {
        disabled: false,
        methodsDisabled: 0,
        message: `Failed to disable 2FA: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        status: 'ic',
      } as Disable2faOutput & AuthOutput;
    }
  },
};

/**
 * Clean up related 2FA data when methods are disabled
 */
async function cleanupRelatedData(orm: any, userId: string, methods: any[]): Promise<void> {
  // Get method IDs
  const methodIds = methods.map(m => m.id);

  // Clean up unused verification codes for these methods
  if (methodIds.length > 0) {
    await orm.deleteMany('two_factor_codes', {
      where: (b: any) => b.and([
        b('userId', '=', userId),
        b('methodId', 'IN', methodIds)
      ]),
    });
  }

  // If all methods are being disabled, clean up backup codes and failed attempts
  const remainingMethods = await orm.findMany('two_factor_methods', {
    where: (b: any) => b('userId', '=', userId),
  });

  if (remainingMethods.length === 0) {
    // No 2FA methods left, clean up all related data
    await orm.deleteMany('two_factor_backup_codes', {
      where: (b: any) => b('userId', '=', userId),
    });

    await orm.deleteMany('two_factor_failed_attempts', {
      where: (b: any) => b('userId', '=', userId),
    });

    await orm.deleteMany('two_factor_codes', {
      where: (b: any) => b('userId', '=', userId),
    });
  }
}