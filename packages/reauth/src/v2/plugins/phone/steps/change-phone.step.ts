import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { PhonePasswordConfigV2 } from '../types';
import { verifyPasswordHash } from '../../../../lib/password';
import { phoneSchema } from '../../../../plugins/shared/validation';
import { generateCode as defaultGenerateCode } from '../utils';

export type ChangePhoneInput = {
  token: string;
  currentPassword: string;
  newPhone: string;
  others?: Record<string, any>;
};

export const changePhoneValidation = type({
  token: 'string',
  currentPassword: 'string',
  newPhone: 'string',
  others: 'object?',
});

export const changePhoneStep: AuthStepV2<
  ChangePhoneInput,
  AuthOutput,
  PhonePasswordConfigV2
> = {
  name: 'change-phone',
  description: 'Change phone number for authenticated user',
  validationSchema: changePhoneValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ip: 401, ic: 400, unauth: 401 },
      auth: true, // Requires authentication
    },
  },
  inputs: ['token', 'currentPassword', 'newPhone', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { token, currentPassword, newPhone, others } = input;
    const orm = await ctx.engine.getOrm();

    // This step requires authentication - get subject from session  
    const check = await ctx.engine.checkSession(token);
    if (!check.valid || !check.subject?.id) {
      return {
        success: false,
        message: 'Authentication required',
        status: 'unauth',
        others,
      };
    }

    const subjectId = check.subject.id as string;

    // Load current credentials to verify password
    const creds = await orm.findFirst('credentials', {
      where: (b) => b('subject_id', '=', subjectId),
    });

    if (!creds?.password_hash) {
      return {
        success: false,
        message: 'Current password not found',
        status: 'ip',
        others,
      };
    }

    // Verify current password
    const isCurrentPasswordValid = await verifyPasswordHash(
      creds.password_hash as string,
      currentPassword,
    );

    if (!isCurrentPasswordValid) {
      return {
        success: false,
        message: 'Current password is incorrect',
        status: 'ip',
        others,
      };
    }

    // Check if new phone is already taken by another user
    const existingIdentity = await orm.findFirst('identities', {
      where: (b) =>
        b.and(
          b('provider', '=', 'phone'),
          b('identifier', '=', newPhone),
          b('subject_id', '!=', subjectId),
        ),
    });

    if (existingIdentity) {
      return {
        success: false,
        message: 'Phone number is already in use',
        status: 'ic',
        others,
      };
    }

    // Find current phone identity
    const currentIdentity = await orm.findFirst('identities', {
      where: (b) =>
        b.and(
          b('provider', '=', 'phone'),
          b('subject_id', '=', subjectId),
        ),
    });

    if (!currentIdentity) {
      return {
        success: false,
        message: 'Current phone identity not found',
        status: 'ic',
        others,
      };
    }

    // If verification is required, generate and send code
    if (ctx.config?.verifyPhone && ctx.config.sendCode) {
      const generateCode = ctx.config.generateCode || defaultGenerateCode;
      const code = await generateCode(newPhone, check.subject);
      const codeStr = String(code);
      
      // Hash the verification code for storage
      const hashedCode = await require('../../../../lib/password').hashPassword(codeStr);
      
      const expiresAt = new Date(
        Date.now() + (ctx.config.verificationCodeExpiresIn || 30 * 60 * 1000),
      );

      // Find or create phone_identities record
      const phoneIdentity = await orm.findFirst('phone_identities', {
        where: (b) => b('identity_id', '=', currentIdentity.id),
      });

      if (phoneIdentity) {
        // Update existing record with new verification code
        await orm.updateMany('phone_identities', {
          where: (b) => b('identity_id', '=', currentIdentity.id),
          set: {
            verification_code: hashedCode,
            verification_code_expires_at: expiresAt,
            updated_at: new Date(),
          },
        });
      } else {
        // Create new phone_identities record
        await orm.create('phone_identities', {
          identity_id: currentIdentity.id,
          verification_code: hashedCode,
          verification_code_expires_at: expiresAt,
        });
      }

      // Send verification code to NEW phone number
      try {
        await ctx.config.sendCode(check.subject, code, newPhone, 'verify');
      } catch (error) {
        return {
          success: false,
          message: 'Failed to send verification code',
          error,
          status: 'ic',
          others,
        };
      }

      // Store the new phone temporarily (not yet verified)
      // We'll store it in a temp field or wait for verification step
      // For now, return success indicating verification is required
      return {
        success: true,
        message: 'Verification code sent to new phone number. Please verify to complete the change.',
        status: 'su',
        others: {
          ...others,
          requiresVerification: true,
          tempPhone: newPhone,
        },
      };
    } else {
      // No verification required - update phone immediately
      await orm.updateMany('identities', {
        where: (b) => b('id', '=', currentIdentity.id),
        set: {
          identifier: newPhone,
          verified: false, // Reset verification status
          updated_at: new Date(),
        },
      });

      return {
        success: true,
        message: 'Phone number changed successfully',
        status: 'su',
        others,
      };
    }
  },
};