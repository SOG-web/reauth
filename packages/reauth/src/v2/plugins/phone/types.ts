import type { BasePluginConfigV2, TestUsersConfigV2 } from '../../types.v2';

// Phone plugin configuration with discriminated union for type safety
export type PhoneConfigV2 = BasePluginConfigV2 & {
  verifyPhone: true;
  sendCode: (subject: string, code: string, to: string, type: 'verification' | 'reset') => Promise<void>;
  codeLength?: number;
  verificationCodeExpiresIn?: number;
  resetPasswordCodeExpiresIn?: number;
} | BasePluginConfigV2 & {
  verifyPhone: false;
  sendCode?: never;
  codeLength?: never;
  verificationCodeExpiresIn?: never;
  resetPasswordCodeExpiresIn?: never;
};

// Default configuration
export const defaultPhoneConfig: Partial<PhoneConfigV2> = {
  verifyPhone: true,
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