import type { AuthPluginV2 } from '../../types.v2';
import type { PhoneConfigV2 } from './types';
import { defaultPhoneConfig } from './types';
import { phoneIdentitiesSchema } from './schema.v2';
import { loginStep } from './steps/login.step';
import { registerStep } from './steps/register.step';
import { verifyPhoneStep } from './steps/verify-phone.step';
import { resendVerifyPhoneStep } from './steps/resend-verify-phone.step';
import { sendResetPasswordStep } from './steps/send-reset-password.step';
import { resetPasswordStep } from './steps/reset-password.step';
import { changePasswordStep } from './steps/change-password.step';

export function createPhonePlugin(config: Partial<PhoneConfigV2>): AuthPluginV2<PhoneConfigV2> {
  const finalConfig = { ...defaultPhoneConfig, ...config } as PhoneConfigV2;

  return {
    name: 'phone',
    version: '2.0',
    config: finalConfig,
    
    steps: [
      loginStep,
      registerStep,
      verifyPhoneStep,
      resendVerifyPhoneStep,
      sendResetPasswordStep,
      resetPasswordStep,
      changePasswordStep,
    ],

    schemas: {
      tables: [phoneIdentitiesSchema],
      indexes: [
        {
          name: 'idx_phone_identities_identity_id',
          table: 'phone_identities',
          columns: ['identity_id'],
          unique: true,
        },
      ],
    },

    // Session resolver for phone plugin
    sessionResolver: async (subject_id: string) => {
      // TODO: Implement session resolution based on subject_id
      // This would typically query the sessions table
      return null;
    },

    // Plugin initialization
    initialize: () => {
      // Validate configuration at initialization time
      if (finalConfig.verifyPhone && !finalConfig.sendCode) {
        throw new Error('Phone plugin requires sendCode function when verifyPhone is true');
      }
      
      if (finalConfig.codeLength && (finalConfig.codeLength < 4 || finalConfig.codeLength > 8)) {
        throw new Error('Phone plugin codeLength must be between 4 and 8');
      }
      
      if (finalConfig.sessionTtlSeconds && finalConfig.sessionTtlSeconds < 30) {
        throw new Error('Phone plugin sessionTtlSeconds must be at least 30 seconds');
      }
      
      console.log('Phone plugin initialized successfully');
    },
  };
}