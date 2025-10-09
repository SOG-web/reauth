import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  type Token,
  tokenType,
} from '../../../types';
import type { EmailPasswordConfig } from '../types';
import { verifyPasswordHash, hashPassword } from '../../../lib/password';
import { emailSchema, passwordSchema } from '../../shared/validation';
import { generateCode as defaultGenerateCode } from '../utils';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export type ChangeEmailInput = {
  token: Token;
  currentPassword: string;
  newEmail: string;
  others?: Record<string, any>;
};

export const changeEmailValidation = type({
  token: tokenType,
  currentPassword: passwordSchema,
  newEmail: emailSchema,
  'others?': 'object',
});

export const changeEmailStep: AuthStep<
  EmailPasswordConfig,
  'change-email',
  ChangeEmailInput,
  AuthOutput
> = {
  name: 'change-email',
  description: 'Change email address for authenticated user',
  validationSchema: changeEmailValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ip: 401, ic: 400, unauth: 401 },
      auth: true, // Requires authentication
    },
  },
  inputs: ['token', 'currentPassword', 'newEmail', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'others?': 'object',
    'token?': tokenType,
  }),
  async run(input, ctx) {
    const { token, currentPassword, newEmail, others } = input;
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
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Current password not found',
          status: 'ip',
          others,
        },
        token,
        check.token,
      );
    }

    // Verify current password
    const isCurrentPasswordValid = await verifyPasswordHash(
      creds.password_hash as string,
      currentPassword,
    );

    if (!isCurrentPasswordValid) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Current password is incorrect',
          status: 'ip',
          others,
        },
        token,
        check.token,
      );
    }

    // Check if new email is already taken by another user
    const existingIdentity = await orm.findFirst('identities', {
      where: (b) =>
        b.and(
          b('provider', '=', 'email'),
          b('identifier', '=', newEmail),
          b('subject_id', '!=', subjectId),
        ),
    });

    if (existingIdentity) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Email address is already in use',
          status: 'ic',
          others,
        },
        token,
        check.token,
      );
    }

    // Find current email identity
    const currentIdentity = await orm.findFirst('identities', {
      where: (b) =>
        b.and(b('provider', '=', 'email'), b('subject_id', '=', subjectId)),
    });

    if (!currentIdentity) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Current email identity not found',
          status: 'ic',
          others,
        },
        token,
        check.token,
      );
    }

    // Update email address immediately regardless of verification settings
    await orm.updateMany('identities', {
      where: (b) => b('id', '=', currentIdentity.id),
      set: {
        identifier: newEmail,
        verified: false, // Reset verification status - will be verified on next login
        updated_at: new Date(),
      },
    });

    // If verification is enabled and sendCode is configured, send verification code for future login
    if (ctx.config?.verifyEmail && ctx.config.sendCode) {
      const generateCode = ctx.config.generateCode || defaultGenerateCode;
      const code = await generateCode(newEmail, check.subject);
      const codeStr = String(code);

      // Hash the verification code for storage
      const hashedCode = await hashPassword(codeStr);

      const expiresAt = new Date(
        Date.now() + (ctx.config.verificationCodeExpiresIn || 30 * 60 * 1000),
      );

      // Find or create email_identities record
      const emailIdentity = await orm.findFirst('email_identities', {
        where: (b) => b('identity_id', '=', currentIdentity.id),
      });

      if (emailIdentity) {
        // Update existing record with new verification code
        await orm.updateMany('email_identities', {
          where: (b) => b('identity_id', '=', currentIdentity.id),
          set: {
            verification_code: hashedCode,
            verification_code_expires_at: expiresAt,
            updated_at: new Date(),
          },
        });
      } else {
        // Create new email_identities record
        await orm.create('email_identities', {
          identity_id: currentIdentity.id,
          verification_code: hashedCode,
          verification_code_expires_at: expiresAt,
        });
      }

      // Send verification code to new email address for future login verification
      try {
        await ctx.config.sendCode(check.subject, code, newEmail, 'verify');
        return attachNewTokenIfDifferent(
          {
            success: true,
            message:
              'Email address changed successfully. Verification code sent for next login.',
            status: 'su',
            others,
            token,
          },
          token,
          check.token,
        );
      } catch (error) {
        // Even if sending fails, the email was already updated successfully
        return attachNewTokenIfDifferent(
          {
            success: true,
            message:
              'Email address changed successfully. Verification code could not be sent.',
            status: 'su',
            others: {
              ...others,
              sendCodeError: error,
            },
          },
          token,
          check.token,
        );
      }
    } else {
      return attachNewTokenIfDifferent(
        {
          success: true,
          message: 'Email address changed successfully',
          status: 'su',
          others,
        },
        token,
        check.token,
      );
    }
  },
};
