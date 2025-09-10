import type { BasePluginConfigV2, TestUsersConfigV2 } from '../../types.v2';

// Email plugin configuration with discriminated union for type safety
export type EmailConfigV2 = BasePluginConfigV2 & {
  verifyEmail: true;
  sendCode: (subject: string, code: string, to: string, type: 'verification' | 'reset') => Promise<void>;
  codeLength?: number;
  verificationCodeExpiresIn?: number;
  resetPasswordCodeExpiresIn?: number;
} | BasePluginConfigV2 & {
  verifyEmail: false;
  sendCode?: never;
  codeLength?: never;
  verificationCodeExpiresIn?: never;
  resetPasswordCodeExpiresIn?: never;
};

// Default configuration
export const defaultEmailConfig: Partial<EmailConfigV2> = {
  verifyEmail: true,
  loginOnRegister: false,
  sessionTtlSeconds: 3600, // 1 hour
  codeLength: 6,
  verificationCodeExpiresIn: 900, // 15 minutes
  resetPasswordCodeExpiresIn: 900, // 15 minutes
  testUsers: {
    enabled: false,
    environmentGating: false,
    users: [],
  },
};