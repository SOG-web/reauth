import { type } from 'arktype';
import type { AuthStepV2, AuthInputV2, AuthOutputV2, StepContextV2 } from '../../../types.v2';
import type { PhoneConfigV2 } from '../types';
import { hashPassword } from '../../../../lib/password';
import { phoneSchema } from '../../../../plugins/shared/validation';
import { genCode } from '../utils';

// Input schema
const sendResetPasswordInputSchema = type({
  phone: phoneSchema,
  others: 'object?',
});

// Output schema
const sendResetPasswordOutputSchema = type({
  success: 'boolean',
  message: 'string?',
  others: 'object?',
});

interface SendResetPasswordInput {
  phone: string;
  others?: Record<string, any>;
}

interface SendResetPasswordOutput {
  success: boolean;
  message?: string;
  others?: Record<string, any>;
}

export const sendResetPasswordStep: AuthStepV2<SendResetPasswordInput, SendResetPasswordOutput> = {
  name: 'send-reset-password',
  description: 'Send password reset code via SMS',
  inputs: sendResetPasswordInputSchema,
  outputs: sendResetPasswordOutputSchema,
  protocol: {
    method: 'POST',
    path: '/phone/send-reset',
    auth: false,
    statusCodes: {
      success: 200,
      error: 400,
      validation: 400,
    },
  },

  async run(input: SendResetPasswordInput, context: StepContextV2): Promise<SendResetPasswordOutput> {
    const { phone, others } = input;
    const { container, config } = context;
    const phoneConfig = config as PhoneConfigV2;
    const entityService = container.cradle.entityService;

    try {
      // Find identity by provider=phone, identifier=phone
      const identity = await entityService.findIdentity('phone', phone);
      
      if (!identity) {
        // Use unified ambiguous response to prevent user enumeration
        return {
          success: true,
          message: 'If this phone number is registered, you will receive a reset code',
          others,
        };
      }

      // Generate reset code and hash at rest
      const code = genCode(phoneConfig.codeLength || 6);
      const hashedCode = await hashPassword(code);
      const expiresAt = new Date(Date.now() + (phoneConfig.resetPasswordCodeExpiresIn || 900) * 1000);
      
      // TODO: Store hashed reset code in phone_identities table
      // await upsertResetCode(identity.id, hashedCode, expiresAt);

      // Send code via SMS
      if (phoneConfig.sendCode) {
        await phoneConfig.sendCode(identity.subject_id, code, phone, 'reset');
      }

      return {
        success: true,
        message: 'If this phone number is registered, you will receive a reset code',
        others,
      };

    } catch (error) {
      // Always return success to prevent user enumeration
      return {
        success: true,
        message: 'If this phone number is registered, you will receive a reset code',
        others,
      };
    }
  },
};