import type { AuthPluginV2 } from '../../types.v2';
import type { UsernameConfigV2 } from './types';
import { defaultUsernameConfig } from './types';
import { usernameIdentitiesSchema } from './schema.v2';
import { loginStep } from './steps/login.step';
import { registerStep } from './steps/register.step';
import { changePasswordStep } from './steps/change-password.step';

export function createUsernamePlugin(config: Partial<UsernameConfigV2>): AuthPluginV2<UsernameConfigV2> {
  const finalConfig = { ...defaultUsernameConfig, ...config } as UsernameConfigV2;

  return {
    name: 'username',
    version: '2.0',
    config: finalConfig,
    
    steps: [
      loginStep,
      registerStep,
      changePasswordStep,
    ],

    schemas: {
      tables: [usernameIdentitiesSchema],
      indexes: [
        {
          name: 'idx_username_identities_identity_id',
          table: 'username_identities',
          columns: ['identity_id'],
          unique: true,
        },
      ],
    },

    // Session resolver for username plugin
    sessionResolver: async (subject_id: string) => {
      // TODO: Implement session resolution based on subject_id
      // This would typically query the sessions table
      return null;
    },

    // Plugin initialization
    initialize: () => {
      // Validate configuration at initialization time
      if (finalConfig.sessionTtlSeconds && finalConfig.sessionTtlSeconds < 30) {
        throw new Error('Username plugin sessionTtlSeconds must be at least 30 seconds');
      }
      
      console.log('Username plugin initialized successfully');
    },
  };
}