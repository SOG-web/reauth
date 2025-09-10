import type { BasePluginConfigV2, TestUsersConfigV2 } from '../../types.v2';

// Username plugin configuration (no verification per product decision)
export type UsernameConfigV2 = BasePluginConfigV2 & {
  // No verification fields since username has no verification
};

// Default configuration
export const defaultUsernameConfig: Partial<UsernameConfigV2> = {
  loginOnRegister: false,
  sessionTtlSeconds: 3600, // 1 hour
  testUsers: {
    enabled: false,
    environmentGating: false,
    users: [],
  },
};