import { type } from 'arktype';
import type { AuthStepV2, AuthInputV2, AuthOutputV2, StepContextV2 } from '../../../types.v2';
import type { PhoneConfigV2 } from '../types';
import { hashPassword } from '../../../../lib/password';
import { phoneSchema } from '../../../../plugins/shared/validation';
import { genCode } from '../utils';

// Input schema
const resendVerifyPhoneInputSchema = type({
  phone: phoneSchema,
  others: 'object?',
});

// Output schema
const resendVerifyPhoneOutputSchema = type({
  success: 'boolean',
  message: 'string?',
  subject: 'string?',
  others: 'object?',
});

interface ResendVerifyPhoneInput {
  phone: string;
  others?: Record<string, any>;
}

interface ResendVerifyPhoneOutput {
  success: boolean;
  message?: string;
  subject?: string;
  others?: Record<string, any>;
}

export const resendVerifyPhoneStep: AuthStepV2<ResendVerifyPhoneInput, ResendVerifyPhoneOutput> = {
  name: 'resend-verify-phone',
  description: 'Resend phone verification code',
  inputs: resendVerifyPhoneInputSchema,
  outputs: resendVerifyPhoneOutputSchema,
  protocol: {
    method: 'POST',
    path: '/phone/resend-verify',
    auth: false,
    statusCodes: {
      success: 200,
      error: 400,
      validation: 400,
    },
  },

  async run(input: ResendVerifyPhoneInput, context: StepContextV2): Promise<ResendVerifyPhoneOutput> {
    const { phone, others } = input;
    const { container, config } = context;
    const phoneConfig = config as PhoneConfigV2;
    const entityService = container.cradle.entityService;

    try {
      // Find identity by provider=phone, identifier=phone
      const identity = await entityService.findIdentity('phone', phone);
      
      if (!identity) {
        return {
          success: false,
          message: 'Phone number not found',
          others,
        };
      }

      if (identity.verified) {
        return {
          success: false,
          message: 'Phone number already verified',
          others,
        };
      }

      // Generate new verification code and store hashed
      const code = genCode(phoneConfig.codeLength || 6);
      const hashedCode = await hashPassword(code);
      const expiresAt = new Date(Date.now() + (phoneConfig.verificationCodeExpiresIn || 900) * 1000);
      
      // TODO: Upsert hashed code in phone_identities table
      // await upsertVerificationCode(identity.id, hashedCode, expiresAt);

      // Send code via SMS
      if (phoneConfig.sendCode) {
        await phoneConfig.sendCode(identity.subject_id, code, phone, 'verification');
      }

      return {
        success: true,
        message: 'Verification code sent to your phone',
        subject: identity.subject_id,
        others,
      };

    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to resend verification code',
        others,
      };
    }
  },
};