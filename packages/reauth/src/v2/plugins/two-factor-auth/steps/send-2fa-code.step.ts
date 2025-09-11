import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { TwoFactorAuthConfigV2 } from '../types';
import { generateRandomString, hashString } from '../utils/crypto';
import { checkCodeGenerationRateLimit } from '../utils/rate-limiting';

export interface Send2faCodeInput {
  userId: string;
  methodType: 'sms' | 'email';
  methodId?: string; // If provided, use specific method; otherwise use primary
}

export interface Send2faCodeOutput {
  codeSent: boolean;
  message: string;
  expiresAt?: Date;
  attemptsRemaining?: number;
}

export const send2faCodeValidation = type({
  userId: 'string',
  methodType: '"sms" | "email"',
  'methodId?': 'string',
});

export const send2faCodeStep: AuthStepV2<
  Send2faCodeInput,
  Send2faCodeOutput,
  TwoFactorAuthConfigV2
> = {
  name: 'send-2fa-code',
  description: 'Send verification code via SMS or email',
  validationSchema: send2faCodeValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ic: 400, rl: 429, sn: 404 },
    },
  },
  inputs: ['userId', 'methodType', 'methodId'],
  outputs: type({
    codeSent: 'boolean',
    message: 'string',
    'expiresAt?': 'string',
    'attemptsRemaining?': 'number',
  }),

  async run(input, ctx) {
    const { userId, methodType, methodId } = input;
    const orm = await ctx.engine.getOrm();
    const config = ctx.config;

    // Check if the method is enabled
    const methodConfig = methodType === 'sms' ? config.sms : config.email;
    if (!methodConfig?.enabled) {
      return {
        codeSent: false,
        message: `${methodType.toUpperCase()} 2FA is not enabled`,
        status: 'sn',
      } as Send2faCodeOutput & AuthOutput;
    }

    // Check rate limiting
    const rateLimit = await checkCodeGenerationRateLimit(orm, userId, methodType, config);
    if (!rateLimit.allowed) {
      return {
        codeSent: false,
        message: `Rate limit exceeded. Try again after ${rateLimit.resetTime.toLocaleTimeString()}`,
        attemptsRemaining: rateLimit.remainingAttempts,
        status: 'rl',
      } as Send2faCodeOutput & AuthOutput;
    }

    try {
      // Find the method to use
      let method;
      if (methodId) {
        method = await orm.findFirst('two_factor_methods', {
          where: (b: any) => b.and([
            b('id', '=', methodId),
            b('user_id', '=', userId),
            b('method_type', '=', methodType)
          ]),
        });
      } else {
        // Find primary method or any verified method of this type
        method = await orm.findFirst('two_factor_methods', {
          where: (b: any) => b.and([
            b('user_id', '=', userId),
            b('method_type', '=', methodType),
            b('is_verified', '=', true)
          ]),
          orderBy: [['is_primary', 'desc'], ['last_used_at', 'desc']],
        });
      }

      if (!method) {
        return {
          codeSent: false,
          message: `No verified ${methodType.toUpperCase()} method found`,
          status: 'sn',
        } as Send2faCodeOutput & AuthOutput;
      }

      // Generate verification code
      const codeLength = methodConfig.codeLength || 6;
      const code = generateRandomString(codeLength, '0123456789');
      const hashedCode = await hashString(code);
      const expiryMinutes = methodConfig.expiryMinutes || 10;
      const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

      // Store the verification code
      const codeRecord = await orm.create('two_factor_codes', {
        user_id: userId,
        method_id: method.id,
        code_hash: hashedCode,
        method_type: methodType,
        expires_at: expiresAt,
        attempts: 0,
        created_at: new Date(),
      });

      // Send the code via SMS or email
      let sendSuccess = false;
      let sendError: string | null = null;

      try {
        if (methodType === 'sms' && config.sms?.sendCode) {
          const phoneNumber = method.phone_number_encrypted; // TODO: Decrypt in production
          await config.sms.sendCode(phoneNumber, code, userId);
          sendSuccess = true;
        } else if (methodType === 'email' && config.email?.sendCode) {
          const email = method.email_encrypted; // TODO: Decrypt in production
          await config.email.sendCode(email, code, userId);
          sendSuccess = true;
        } else {
          sendError = `No send function configured for ${methodType}`;
        }
      } catch (error) {
        sendError = error instanceof Error ? error.message : 'Failed to send code';
      }

      if (!sendSuccess) {
        // Clean up the code record if sending failed
        await orm.deleteMany('two_factor_codes', {
          where: (b: any) => b('id', '=', codeRecord.id),
        });

        return {
          codeSent: false,
          message: sendError || `Failed to send ${methodType} code`,
          status: 'ic',
        } as Send2faCodeOutput & AuthOutput;
      }

      // Update rate limiting info
      const updatedRateLimit = await checkCodeGenerationRateLimit(orm, userId, methodType, config);

      return {
        codeSent: true,
        message: `Verification code sent via ${methodType.toUpperCase()}`,
        expiresAt,
        attemptsRemaining: updatedRateLimit.remainingAttempts,
        status: 'su',
      } as Send2faCodeOutput & AuthOutput;

    } catch (error) {
      return {
        codeSent: false,
        message: `Failed to send verification code: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'ic',
      } as Send2faCodeOutput & AuthOutput;
    }
  },
};