import { type } from 'arktype';
import type { AuthStepV2, AuthInputV2, AuthOutputV2, StepContextV2 } from '../../../types.v2';
import type { PhoneConfigV2 } from '../types';
import { verifyPasswordHash } from '../../../../lib/password';
import { phoneSchema } from '../../../../plugins/shared/validation';

// Input schema
const verifyPhoneInputSchema = type({
  phone: phoneSchema,
  code: 'string',
  others: 'object?',
});

// Output schema
const verifyPhoneOutputSchema = type({
  success: 'boolean',
  message: 'string?',
  subject: 'string?',
  others: 'object?',
});

interface VerifyPhoneInput {
  phone: string;
  code: string;
  others?: Record<string, any>;
}

interface VerifyPhoneOutput {
  success: boolean;
  message?: string;
  subject?: string;
  others?: Record<string, any>;
}

export const verifyPhoneStep: AuthStepV2<VerifyPhoneInput, VerifyPhoneOutput> = {
  name: 'verify-phone',
  description: 'Verify phone number with verification code',
  inputs: verifyPhoneInputSchema,
  outputs: verifyPhoneOutputSchema,
  protocol: {
    method: 'POST',
    path: '/phone/verify',
    auth: false,
    statusCodes: {
      success: 200,
      error: 400,
      validation: 400,
    },
  },

  async run(input: VerifyPhoneInput, context: StepContextV2): Promise<VerifyPhoneOutput> {
    const { phone, code, others } = input;
    const { container, config } = context;
    const phoneConfig = config as PhoneConfigV2;
    const entityService = container.cradle.entityService;

    try {
      // Find identity by provider=phone, identifier=phone
      const identity = await entityService.findIdentity('phone', phone);
      
      if (!identity) {
        return {
          success: false,
          message: 'Invalid phone or code',
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

      // TODO: Get verification code from phone_identities table
      // For now, simplified implementation - in production, fetch from DB:
      // const phoneIdentity = await getPhoneIdentity(identity.id);
      // 
      // Check code expiry
      // if (phoneIdentity.verification_code_expires_at < new Date()) {
      //   return {
      //     success: false,
      //     message: 'Verification code expired',
      //     others,
      //   };
      // }
      // 
      // Verify hashed code using constant-time verification
      // const codeValid = await verifyPasswordHash(phoneIdentity.verification_code, code);
      // 
      // if (!codeValid) {
      //   return {
      //     success: false,
      //     message: 'Invalid phone or code',
      //     others,
      //   };
      // }

      // Simplified validation for now - in production use hashed verification
      // This is just for demonstration of the step structure
      if (code.length !== (phoneConfig.codeLength || 6)) {
        return {
          success: false,
          message: 'Invalid phone or code',
          others,
        };
      }

      // Set identity as verified and clear verification code fields
      await entityService.updateIdentity(identity.id, { verified: true });
      
      // TODO: Clear verification code fields from phone_identities table
      // await clearVerificationCode(identity.id);

      return {
        success: true,
        message: 'Phone number verified successfully',
        subject: identity.subject_id,
        others,
      };

    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Verification failed',
        others,
      };
    }
  },
};