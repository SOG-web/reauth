import { type } from 'arktype';
import type { AuthStep, AuthOutput } from '../../../types.';
import type { PhonePasswordConfig } from '../types';
import { hashPassword, verifyPasswordHash } from '../../../../lib/password';
import {
  passwordSchema,
  phoneSchema,
} from '../../../../plugins/shared/validation';
import { generateCode as defaultGenerateCode } from '../utils';

export type ChangePhoneInput = {
  token: string;
  currentPassword: string;
  newPhone: string;
  others?: Record<string, any>;
};

export const changePhoneValidation = type({
  token: 'string',
  currentPassword: passwordSchema,
  newPhone: phoneSchema,
  others: 'object?',
});

export const changePhoneStep: AuthStep<
  ChangePhoneInput,
  AuthOutput,
  PhonePasswordConfig
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
        b.and(b('provider', '=', 'phone'), b('subject_id', '=', subjectId)),
    });

    if (!currentIdentity) {
      return {
        success: false,
        message: 'Current phone identity not found',
        status: 'ic',
        others,
      };
    }

    // Update phone number immediately regardless of verification settings
    await orm.updateMany('identities', {
      where: (b) => b('id', '=', currentIdentity.id),
      set: {
        identifier: newPhone,
        verified: false, // Reset verification status - will be verified on next login
        updated_at: new Date(),
      },
    });

    // If verification is enabled and sendCode is configured, send verification code for future login
    if (ctx.config?.verifyPhone && ctx.config.sendCode) {
      const generateCode = ctx.config.generateCode || defaultGenerateCode;
      const code = await generateCode(newPhone, check.subject);
      const codeStr = String(code);

      // Hash the verification code for storage
      const hashedCode = await hashPassword(codeStr);

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

      // Send verification code to new phone number for future login verification
      try {
        await ctx.config.sendCode(check.subject, code, newPhone, 'verify');
        return {
          success: true,
          message:
            'Phone number changed successfully. Verification code sent for next login.',
          status: 'su',
          others,
        };
      } catch (error) {
        // Even if sending fails, the phone was already updated successfully
        return {
          success: true,
          message:
            'Phone number changed successfully. Verification code could not be sent.',
          status: 'su',
          others: {
            ...others,
            sendCodeError: error,
          },
        };
      }
    } else {
      return {
        success: true,
        message: 'Phone number changed successfully',
        status: 'su',
        others,
      };
    }
  },
};
