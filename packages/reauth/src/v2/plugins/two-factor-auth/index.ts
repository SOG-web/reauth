export { default as twoFactorAuthPluginV2, baseTwoFactorAuthPluginV2 } from './plugin.v2';
export type { TwoFactorAuthConfigV2 } from './types';
export { twoFactorAuthSchema } from './schema.v2';

// Export step types for external use
export type {
  Setup2faInput,
  Setup2faOutput,
  Verify2faInput,
  Verify2faOutput,
  GenerateBackupCodesInput,
  GenerateBackupCodesOutput,
  ListMethodsInput,
  ListMethodsOutput,
} from './types';

// Export utility functions for advanced usage
export {
  generateTotpSecret,
  generateTotp,
  verifyTotp,
  generateTotpQrUrl,
  generateRandomString,
  hashString,
} from './utils/crypto';

export {
  cleanupExpiredCodes,
  cleanupFailedAttempts,
  cleanup2faData,
} from './utils/cleanup';

export {
  isUserLockedOut,
  recordFailedAttempt,
  clearFailedAttempts,
  checkCodeGenerationRateLimit,
} from './utils/rate-limiting';