import type { EmailPasswordConfig } from './types';
import type { OrmLike } from '../../types';

export const isTestEnvironmentAllowed = (
  config: EmailPasswordConfig,
): boolean => {
  if (!config.testUsers?.enabled) return false;
  return config.testUsers.checkEnvironment(config.testUsers.environment);
};

export const findTestUser = (
  email: string,
  password: string,
  config: EmailPasswordConfig,
): { email: string; password: string; profile: Record<string, any> } | null => {
  if (!isTestEnvironmentAllowed(config)) return null;
  return (
    config.testUsers?.users.find(
      (u) => u.email === email && u.password === password,
    ) || null
  );
};

export const genCode = (config?: EmailPasswordConfig) => {
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

export const generateCode = async (
  email: string,
  subject?: any,
): Promise<string> => {
  // Default code generation for email verification
  return genCode();
};

/**
 * Clean up expired verification and reset codes from email_identities table
 */
export const cleanupExpiredCodes = async (
  orm: OrmLike,
  config?: EmailPasswordConfig,
): Promise<{ verificationCodesDeleted: number; resetCodesDeleted: number }> => {
  const now = new Date();

  let verificationCodesDeleted = 0;
  let resetCodesDeleted = 0;

  try {
    // Clean up expired verification codes
    // Delete codes that are both expired AND past retention period
    const verificationResult = await orm.updateMany('email_identities', {
      where: (b: any) =>
        b.and(
          b('verification_code_expires_at', '!=', null),
          b('verification_code_expires_at', '<', now),
        ),
      set: {
        verification_code: null,
        verification_code_expires_at: null,
      },
    });

    verificationCodesDeleted =
      typeof verificationResult === 'number' ? verificationResult : 0;

    // Clean up expired reset codes
    // Delete codes that are both expired AND past retention period
    const resetResult = await orm.updateMany('email_identities', {
      where: (b: any) =>
        b.and(
          b('reset_code_expires_at', '!=', null),
          b('reset_code_expires_at', '<', now),
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

  return { verificationCodesDeleted, resetCodesDeleted };
};
