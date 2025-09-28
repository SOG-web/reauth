import type { UsernamePasswordConfig } from './types';
import type { OrmLike } from '../../types.';

export const isTestEnvironmentAllowed = (
  config: UsernamePasswordConfig,
): boolean => {
  if (!config.testUsers?.enabled) return false;
  const env = config.testUsers.environment || 'development';
  if (env === 'all') return true;
  const nodeEnv = process.env.NODE_ENV;
  return (
    env === nodeEnv ||
    (env === 'development' && (!nodeEnv || nodeEnv === 'development'))
  );
};

export const findTestUser = (
  username: string,
  password: string,
  config: UsernamePasswordConfig,
): {
  username: string;
  password: string;
  profile: Record<string, any>;
} | null => {
  if (!isTestEnvironmentAllowed(config)) return null;
  return (
    config.testUsers?.users.find(
      (u) => u.username === username && u.password === password,
    ) || null
  );
};

export const genCode = (config?: UsernamePasswordConfig) => {
  const len = config?.codeLength ?? 4;
  const type = config?.codeType ?? 'numeric';
  const rand = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;
  if (type === 'numeric')
    return Array(len)
      .fill(0)
      .map(() => String.fromCharCode(48 + rand(0, 9)))
      .join('');
  if (type === 'alphabet')
    return Array(len)
      .fill(0)
      .map(() => String.fromCharCode(97 + rand(0, 25)))
      .join('');
  // alphanumeric default
  return Array(len)
    .fill(0)
    .map(() => String.fromCharCode(48 + rand(0, 74)))
    .join('');
};

/**
 * Clean up expired reset codes from username_identities table
 */
export const cleanupExpiredCodes = async (
  orm: OrmLike,
  config?: UsernamePasswordConfig,
): Promise<{ resetCodesDeleted: number }> => {
  const now = new Date();
  const retentionDays = config?.retentionDays ?? 1;
  const batchSize = config?.cleanupBatchSize ?? 100;

  // Calculate cutoff date for retention (expired codes older than this get deleted)
  const retentionCutoffDate = new Date(
    now.getTime() - retentionDays * 24 * 60 * 60 * 1000,
  );

  let resetCodesDeleted = 0;

  try {
    // Clean up expired reset codes
    // Delete codes that are both expired AND past retention period
    const resetResult = await orm.updateMany('username_identities', {
      where: (b: any) =>
        b.and(
          b('reset_code_expires_at', '!=', null),
          b('reset_code_expires_at', '<', now),
          b('reset_code_expires_at', '<', retentionCutoffDate),
        ),
      set: {
        reset_code: null,
        reset_code_expires_at: null,
      },
    });

    resetCodesDeleted = typeof resetResult === 'number' ? resetResult : 0;
  } catch (error) {
    // Return partial results if available, otherwise zero
    // Don't throw to prevent cleanup scheduler from stopping
  }

  return { resetCodesDeleted };
};
