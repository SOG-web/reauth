import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { TwoFactorAuthConfigV2, Setup2faInput, Setup2faOutput } from '../types';
import { generateTotpSecret, generateTotpQrUrl, hashString } from '../utils/crypto';
import { checkCodeGenerationRateLimit } from '../utils/rate-limiting';

export const setup2faValidation = type({
  userId: 'string',
  methodType: '"totp" | "sms" | "email"',
  'phone?': 'string',
  'email?': 'string',  
  'issuer?': 'string',
  'accountName?': 'string',
});

export const setup2faStep: AuthStepV2<
  Setup2faInput,
  Setup2faOutput,
  TwoFactorAuthConfigV2
> = {
  name: 'setup-2fa',
  description: 'Initialize 2FA for a user with specified method',
  validationSchema: setup2faValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ic: 400, rl: 429, sn: 404 },
    },
  },
  inputs: ['userId', 'methodType', 'phone', 'email', 'issuer', 'accountName'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'methodId?': 'string',
    'secret?': 'string',
    'qrCodeUrl?': 'string',
    'verificationRequired?': 'boolean',
  }),

  async run(input, ctx) {
    const { userId, methodType, phone, email, issuer, accountName } = input;
    const orm = await ctx.engine.getOrm();
    const config = ctx.config;

    // Validate method is enabled
    const methodConfig = methodType === 'totp' ? config.totp : 
                        methodType === 'sms' ? config.sms : 
                        methodType === 'email' ? config.email : null;

    if (!methodConfig?.enabled) {
      return {
        success: false,
        message: `${methodType.toUpperCase()} 2FA is not enabled`,
        status: 'sn',
      } as Setup2faOutput & AuthOutput;
    }

    // Check if user already has this method type
    const existingMethod = await orm.findFirst('two_factor_methods', {
      where: (b: any) => b.and([
        b('user_id', '=', userId),
        b('method_type', '=', methodType)
      ]),
    });

    if (existingMethod) {
      return {
        success: false,
        message: `${methodType.toUpperCase()} 2FA is already set up for this user`,
        status: 'ic',
      } as Setup2faOutput & AuthOutput;
    }

    try {
      if (methodType === 'totp') {
        return await setupTotpMethod(orm, userId, config, issuer, accountName);
      } else if (methodType === 'sms') {
        if (!phone) {
          return {
            success: false,
            message: 'Phone number is required for SMS 2FA setup',
            status: 'ic',
          } as Setup2faOutput & AuthOutput;
        }
        return await setupSmsMethod(orm, userId, phone, config);
      } else if (methodType === 'email') {
        if (!email) {
          return {
            success: false,
            message: 'Email address is required for Email 2FA setup',
            status: 'ic',
          } as Setup2faOutput & AuthOutput;
        }
        return await setupEmailMethod(orm, userId, email, config);
      }

      return {
        success: false,
        message: 'Unsupported method type',
        status: 'ic',
      } as Setup2faOutput & AuthOutput;

    } catch (error) {
      return {
        success: false,
        message: `Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'ic',
      } as Setup2faOutput & AuthOutput;
    }
  },
};

async function setupTotpMethod(
  orm: any,
  userId: string,
  config: TwoFactorAuthConfigV2,
  issuer?: string,
  accountName?: string
): Promise<Setup2faOutput & AuthOutput> {
  const secret = generateTotpSecret();
  const totpConfig = config.totp!;
  
  const qrIssuer = issuer || totpConfig.issuer;
  const qrAccountName = accountName || userId;
  const qrCodeUrl = generateTotpQrUrl(
    secret,
    qrIssuer,
    qrAccountName,
    totpConfig.digits,
    totpConfig.period,
    totpConfig.algorithm
  );

  // Store encrypted secret (in real implementation, use proper encryption)
  // For now, we'll store the secret directly but this should be encrypted
  const method = await orm.create('two_factor_methods', {
    user_id: userId,
    method_type: 'totp',
    secret_encrypted: secret, // TODO: Encrypt this in production
    is_primary: false,
    is_verified: false,
    created_at: new Date(),
  });

  return {
    success: true,
    message: 'TOTP 2FA setup initiated. Please scan the QR code and verify.',
    methodId: method.id,
    secret,
    qrCodeUrl,
    verificationRequired: true,
    status: 'su',
  };
}

async function setupSmsMethod(
  orm: any,
  userId: string,
  phone: string,
  config: TwoFactorAuthConfigV2
): Promise<Setup2faOutput & AuthOutput> {
  // Check rate limiting for SMS
  const rateLimit = await checkCodeGenerationRateLimit(orm, userId, 'sms', config);
  if (!rateLimit.allowed) {
    return {
      success: false,
      message: `SMS rate limit exceeded. Try again after ${rateLimit.resetTime.toLocaleTimeString()}`,
      status: 'rl',
    } as Setup2faOutput & AuthOutput;
  }

  // Store encrypted phone number (in real implementation, use proper encryption)
  const method = await orm.create('two_factor_methods', {
    user_id: userId,
    method_type: 'sms',
    phone_number_encrypted: phone, // TODO: Encrypt this in production
    is_primary: false,
    is_verified: false,
    created_at: new Date(),
  });

  return {
    success: true,
    message: 'SMS 2FA setup initiated. A verification code will be sent to verify your phone number.',
    methodId: method.id,
    verificationRequired: true,
    status: 'su',
  };
}

async function setupEmailMethod(
  orm: any,
  userId: string,
  email: string,
  config: TwoFactorAuthConfigV2
): Promise<Setup2faOutput & AuthOutput> {
  // Check rate limiting for Email
  const rateLimit = await checkCodeGenerationRateLimit(orm, userId, 'email', config);
  if (!rateLimit.allowed) {
    return {
      success: false,
      message: `Email rate limit exceeded. Try again after ${rateLimit.resetTime.toLocaleTimeString()}`,
      status: 'rl',
    } as Setup2faOutput & AuthOutput;
  }

  // Store encrypted email (in real implementation, use proper encryption)
  const method = await orm.create('two_factor_methods', {
    user_id: userId,
    method_type: 'email',
    email_encrypted: email, // TODO: Encrypt this in production
    is_primary: false,
    is_verified: false,
    created_at: new Date(),
  });

  return {
    success: true,
    message: 'Email 2FA setup initiated. A verification code will be sent to verify your email.',
    methodId: method.id,
    verificationRequired: true,
    status: 'su',
  };
}