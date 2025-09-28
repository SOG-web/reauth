import type { PhonePasswordConfig } from './types';
import type { OrmLike } from '../../types';

export const isTestEnvironmentAllowed = (
  config: PhonePasswordConfig,
): boolean => {
  if (!config.testUsers?.enabled) return false;
  return config.testUsers.checkEnvironment(config.testUsers.environment);
};

export const findTestUser = (
  phone: string,
  password: string,
  config: PhonePasswordConfig,
): { phone: string; password: string; profile: Record<string, any> } | null => {
  if (!isTestEnvironmentAllowed(config)) return null;
  return (
    config.testUsers?.users.find(
      (u) => u.phone === phone && u.password === password,
    ) || null
  );
};

export const genCode = (config?: PhonePasswordConfig) => {
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
  phone: string,
  subject?: any,
): Promise<string> => {
  // Default code generation for phone verification
  return genCode();
};

/**
 * Clean up expired verification and reset codes from phone_identities table
 */
export const cleanupExpiredCodes = async (
  orm: OrmLike,
): Promise<{ verificationCodesDeleted: number; resetCodesDeleted: number }> => {
  const now = new Date();

  let verificationCodesDeleted = 0;
  let resetCodesDeleted = 0;

  try {
    // Clean up expired verification codes
    // Delete codes that are both expired AND past retention period
    const verificationResult = await orm.updateMany('phone_identities', {
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
    const resetResult = await orm.updateMany('phone_identities', {
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
