import type { OrmLike } from '../../../types.v2';
import type { TwoFactorAuthConfigV2 } from '../types';

/**
 * Clean up expired 2FA codes
 */
export async function cleanupExpiredCodes(
  orm: OrmLike,
  config: TwoFactorAuthConfigV2
): Promise<{ codesDeleted: number; backupCodesDeleted: number }> {
  const now = new Date();
  const retentionHours = config.cleanup?.expiredCodeRetentionHours || 24;
  const cutoffTime = new Date(now.getTime() - retentionHours * 60 * 60 * 1000);

  // Clean expired verification codes
  const expiredCodes = await orm.deleteMany('two_factor_codes', {
    where: (b: any) => b('expiresAt', '<', cutoffTime),
  });

  // Clean used backup codes (optional - keep for audit trail by default)
  const expiredBackupCodes = config.cleanup?.expiredCodeRetentionHours ? 
    await orm.deleteMany('two_factor_backup_codes', {
      where: (b: any) => b.and([
        b('usedAt', 'IS NOT', null),
        b('usedAt', '<', cutoffTime)
      ]),
    }) : { deletedCount: 0 };

  return {
    codesDeleted: expiredCodes.deletedCount || 0,
    backupCodesDeleted: expiredBackupCodes.deletedCount || 0,
  };
}

/**
 * Clean up old failed attempt records
 */
export async function cleanupFailedAttempts(
  orm: OrmLike,
  config: TwoFactorAuthConfigV2
): Promise<{ failedAttemptsDeleted: number }> {
  const retentionDays = config.cleanup?.failedAttemptRetentionDays || 7;
  const cutoffTime = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const deletedAttempts = await orm.deleteMany('two_factor_failed_attempts', {
    where: (b: any) => b('attemptedAt', '<', cutoffTime),
  });

  return {
    failedAttemptsDeleted: deletedAttempts.deletedCount || 0,
  };
}

/**
 * Combined cleanup function for all 2FA-related expired data
 */
export async function cleanup2faData(
  orm: OrmLike,
  config: TwoFactorAuthConfigV2
): Promise<{
  cleaned: number;
  codesDeleted: number;
  backupCodesDeleted: number;
  failedAttemptsDeleted: number;
  errors?: string[];
}> {
  const results = {
    cleaned: 0,
    codesDeleted: 0,
    backupCodesDeleted: 0,
    failedAttemptsDeleted: 0,
    errors: [] as string[],
  };

  try {
    // Clean expired codes
    const codeCleanup = await cleanupExpiredCodes(orm, config);
    results.codesDeleted = codeCleanup.codesDeleted;
    results.backupCodesDeleted = codeCleanup.backupCodesDeleted;
  } catch (error) {
    results.errors.push(`Failed to clean expired codes: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    // Clean failed attempts
    const attemptCleanup = await cleanupFailedAttempts(orm, config);
    results.failedAttemptsDeleted = attemptCleanup.failedAttemptsDeleted;
  } catch (error) {
    results.errors.push(`Failed to clean failed attempts: ${error instanceof Error ? error.message : String(error)}`);
  }

  results.cleaned = results.codesDeleted + results.backupCodesDeleted + results.failedAttemptsDeleted;

  return results;
}