import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { TwoFactorAuthConfigV2, Verify2faInput, Verify2faOutput } from '../types';
import { verifyTotp, hashString } from '../utils/crypto';
import { isUserLockedOut, recordFailedAttempt, clearFailedAttempts } from '../utils/rate-limiting';

export const verify2faValidation = type({
  userId: 'string',
  code: 'string',
  methodType: '"totp" | "sms" | "email" | "backup"',
  'methodId?': 'string',
});

export const verify2faStep: AuthStepV2<
  Verify2faInput,
  Verify2faOutput,
  TwoFactorAuthConfigV2
> = {
  name: 'verify-2fa',
  description: 'Verify 2FA code during authentication',
  validationSchema: verify2faValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, unf: 401, ic: 400, eq: 403 },
    },
  },
  inputs: ['userId', 'code', 'methodType', 'methodId'],
  outputs: type({
    verified: 'boolean',
    'remainingBackupCodes?': 'number',
    'nextRequiredAction?': 'string',
  }),

  async run(input, ctx) {
    const { userId, code, methodType, methodId } = input;
    const orm = await ctx.engine.getOrm();
    const config = ctx.config;

    // Check if user is locked out
    const lockoutCheck = await isUserLockedOut(orm, userId, config);
    if (lockoutCheck.isLockedOut) {
      return {
        verified: false,
        message: `Account temporarily locked due to failed attempts. Try again after ${lockoutCheck.lockoutEndsAt?.toLocaleTimeString()}`,
        status: 'eq',
      } as Verify2faOutput & AuthOutput;
    }

    try {
      let verificationResult = false;
      let remainingBackupCodes: number | undefined;

      if (methodType === 'totp') {
        verificationResult = await verifyTotpCode(orm, userId, code, methodId, config);
      } else if (methodType === 'sms' || methodType === 'email') {
        verificationResult = await verifyTemporaryCode(orm, userId, code, methodType, methodId);
      } else if (methodType === 'backup') {
        const backupResult = await verifyBackupCode(orm, userId, code);
        verificationResult = backupResult.verified;
        remainingBackupCodes = backupResult.remainingCodes;
      } else {
        return {
          verified: false,
          message: 'Unsupported verification method',
          status: 'ic',
        } as Verify2faOutput & AuthOutput;
      }

      if (verificationResult) {
        // Clear any failed attempts on successful verification
        await clearFailedAttempts(orm, userId);

        // Update last used timestamp for the method
        if (methodId && methodType !== 'backup') {
          await orm.updateMany('two_factor_methods', {
            where: (b: any) => b.and([
              b('id', '=', methodId),
              b('user_id', '=', userId)
            ]),
            set: {
              last_used_at: new Date(),
              is_verified: true,
            },
          });
        }

        return {
          verified: true,
          remainingBackupCodes,
          message: '2FA verification successful',
          status: 'su',
        } as Verify2faOutput & AuthOutput;
      } else {
        // Record failed attempt
        await recordFailedAttempt(orm, userId, methodType);

        return {
          verified: false,
          message: 'Invalid 2FA code',
          status: 'unf',
        } as Verify2faOutput & AuthOutput;
      }

    } catch (error) {
      // Record failed attempt on error
      await recordFailedAttempt(orm, userId, methodType);

      return {
        verified: false,
        message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'unf',
      } as Verify2faOutput & AuthOutput;
    }
  },
};

async function verifyTotpCode(
  orm: any,
  userId: string,
  code: string,
  methodId?: string,
  config?: TwoFactorAuthConfigV2
): Promise<boolean> {
  // Find the user's TOTP method
  const whereCondition = methodId ? 
    (b: any) => b.and([
      b('id', '=', methodId),
      b('user_id', '=', userId),
      b('method_type', '=', 'totp')
    ]) :
    (b: any) => b.and([
      b('user_id', '=', userId),
      b('method_type', '=', 'totp'),
      b('is_verified', '=', true)
    ]);

  const method = await orm.findFirst('two_factor_methods', {
    where: whereCondition,
  });

  if (!method || !method.secret_encrypted) {
    return false;
  }

  const totpConfig = config?.totp || {
    digits: 6,
    period: 30,
    window: 1,
    algorithm: 'SHA1' as const,
  };

  // Verify the TOTP code
  return await verifyTotp(
    code,
    method.secret_encrypted, // TODO: Decrypt in production
    totpConfig.window,
    undefined,
    totpConfig.digits,
    totpConfig.period,
    totpConfig.algorithm
  );
}

async function verifyTemporaryCode(
  orm: any,
  userId: string,
  code: string,
  methodType: 'sms' | 'email',
  methodId?: string
): Promise<boolean> {
  const hashedCode = await hashString(code);

  // Find the most recent unused code for this user and method
  const whereCondition = methodId ?
    (b: any) => b.and([
      b('user_id', '=', userId),
      b('method_id', '=', methodId),
      b('method_type', '=', methodType),
      b('used_at', 'IS', null),
      b('expires_at', '>', new Date())
    ]) :
    (b: any) => b.and([
      b('user_id', '=', userId),
      b('method_type', '=', methodType),
      b('used_at', 'IS', null),
      b('expires_at', '>', new Date())
    ]);

  const codeRecord = await orm.findFirst('two_factor_codes', {
    where: whereCondition,
    orderBy: [['created_at', 'desc']],
  });

  if (!codeRecord) {
    return false;
  }

  // Increment attempts counter
  await orm.updateMany('two_factor_codes', {
    where: (b: any) => b('id', '=', codeRecord.id),
    set: {
      attempts: codeRecord.attempts + 1,
    },
  });

  // Check if code matches
  if (codeRecord.code_hash === hashedCode) {
    // Mark code as used
    await orm.updateMany('two_factor_codes', {
      where: (b: any) => b('id', '=', codeRecord.id),
      set: {
        used_at: new Date(),
      },
    });
    return true;
  }

  return false;
}

async function verifyBackupCode(
  orm: any,
  userId: string,
  code: string
): Promise<{ verified: boolean; remainingCodes: number }> {
  const hashedCode = await hashString(code);

  // Find unused backup code
  const backupCode = await orm.findFirst('two_factor_backup_codes', {
    where: (b: any) => b.and([
      b('user_id', '=', userId),
      b('code_hash', '=', hashedCode),
      b('used_at', 'IS', null)
    ]),
  });

  if (!backupCode) {
    // Count remaining backup codes
    const remaining = await orm.findMany('two_factor_backup_codes', {
      where: (b: any) => b.and([
        b('user_id', '=', userId),
        b('used_at', 'IS', null)
      ]),
    });

    return { verified: false, remainingCodes: remaining.length };
  }

  // Mark backup code as used
  await orm.updateMany('two_factor_backup_codes', {
    where: (b: any) => b('id', '=', backupCode.id),
    set: {
      used_at: new Date(),
    },
  });

  // Count remaining backup codes
  const remaining = await orm.findMany('two_factor_backup_codes', {
    where: (b: any) => b.and([
      b('user_id', '=', userId),
      b('used_at', 'IS', null)
    ]),
  });

  return { verified: true, remainingCodes: remaining.length };
}