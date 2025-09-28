import type { OrmLike } from '../../../types.v2';
import type { TwoFactorAuthConfigV2 } from '../types';

/**
 * Check if user is currently locked out due to failed attempts
 */
export async function isUserLockedOut(
  orm: OrmLike,
  userId: string,
  config: TwoFactorAuthConfigV2
): Promise<{ isLockedOut: boolean; lockoutEndsAt?: Date; failedAttempts: number }> {
  const maxAttempts = config.security.maxFailedAttempts || 5;
  const lockoutDuration = config.security.lockoutDurationMinutes || 30;
  const windowStart = new Date(Date.now() - lockoutDuration * 60 * 1000);

  // Count recent failed attempts
  const recentAttempts = await orm.findMany('two_factor_failed_attempts', {
    where: (b: any) => b.and([
      b('user_id', '=', userId),
      b('attempted_at', '>', windowStart)
    ]),
    orderBy: [['attempted_at', 'desc']],
    limit: maxAttempts + 1
  });

  const failedAttempts = recentAttempts.length;
  
  if (failedAttempts >= maxAttempts) {
    // Find the most recent attempt to calculate lockout end time
    const mostRecentAttempt = recentAttempts[0] as any;
    const lockoutEndsAt = mostRecentAttempt ? 
      new Date(mostRecentAttempt.attempted_at.getTime() + lockoutDuration * 60 * 1000) : 
      new Date();

    return {
      isLockedOut: Date.now() < lockoutEndsAt.getTime(),
      lockoutEndsAt,
      failedAttempts
    };
  }

  return { isLockedOut: false, failedAttempts };
}

/**
 * Record a failed 2FA attempt for rate limiting
 */
export async function recordFailedAttempt(
  orm: OrmLike,
  userId: string,
  methodType: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await orm.create('two_factor_failed_attempts', {
    user_id: userId,
    method_type: methodType,
    ip_address: ipAddress,
    user_agent: userAgent,
    attempted_at: new Date(),
  });
}

/**
 * Check SMS/Email rate limiting for code generation
 */
export async function checkCodeGenerationRateLimit(
  orm: OrmLike,
  userId: string,
  methodType: 'sms' | 'email',
  config: TwoFactorAuthConfigV2
): Promise<{ allowed: boolean; remainingAttempts: number; resetTime: Date }> {
  const method = methodType === 'sms' ? config.sms : config.email;
  if (!method?.enabled) {
    return { allowed: false, remainingAttempts: 0, resetTime: new Date() };
  }

  // For SMS, use specific rate limiting config
  const rateLimit = methodType === 'sms' && config.sms?.rateLimit ? config.sms.rateLimit : {
    maxAttempts: 3,
    windowMinutes: 60
  };

  const windowStart = new Date(Date.now() - rateLimit.windowMinutes * 60 * 1000);

  // Count code generation attempts in the current window
  const recentCodes = await orm.findMany('two_factor_codes', {
    where: (b: any) => b.and([
      b('user_id', '=', userId),
      b('method_type', '=', methodType),
      b('created_at', '>', windowStart)
    ]),
    orderBy: [['created_at', 'desc']],
  });

  const attemptsUsed = recentCodes.length;
  const remainingAttempts = Math.max(0, rateLimit.maxAttempts - attemptsUsed);
  
  // Calculate when the rate limit resets (when the oldest attempt expires)
  const oldestAttempt = recentCodes[recentCodes.length - 1] as any;
  const resetTime = oldestAttempt ? 
    new Date(oldestAttempt.created_at.getTime() + rateLimit.windowMinutes * 60 * 1000) :
    new Date();

  return {
    allowed: remainingAttempts > 0,
    remainingAttempts,
    resetTime
  };
}

/**
 * Clear failed attempts for a user (after successful authentication)
 */
export async function clearFailedAttempts(
  orm: OrmLike,
  userId: string
): Promise<void> {
  await orm.deleteMany('two_factor_failed_attempts', {
    where: (b: any) => b('user_id', '=', userId),
  });
}