import { type } from 'arktype';
import { type AuthStep, type AuthOutput, tokenType } from '../../../types';
import { findTestUser, genCode } from '../utils';
import { Token } from '../../../types';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';
import type { PhonePasswordConfig } from '../types';
import { passwordSchema, phoneSchema } from '../../shared/validation';
import { hashPassword, haveIbeenPawned } from '../../../lib/password';

export type RegisterInput = {
  phone: string;
  password: string;
  others?: Record<string, any>;
};

export const registerValidation = type({
  phone: phoneSchema,
  password: passwordSchema,
  others: 'object?',
});

export const registerStep: AuthStep<
  PhonePasswordConfig,
  RegisterInput,
  AuthOutput
> = {
  name: 'register',
  description: 'Register a new user with phone and password',
  validationSchema: registerValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { alr: 409, pwr: 400, su: 201, eq: 202, ic: 400 },
    },
  },
  inputs: ['phone', 'password', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'token?': tokenType,
    'subject?': type({
      id: 'string',
      phone: 'string',
      provider: 'string',
      verified: 'boolean',
      profile: 'object?',
    }),
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { phone, password, others } = input;
    const orm = await ctx.engine.getOrm();

    // Test users first (dev/test envs)
    const tu = findTestUser(phone, password, ctx.config || {});
    if (tu) {
      const subjectRow = { id: phone };

      let token: Token | null = null;
      if (ctx.config?.loginOnRegister) {
        const ttl = ctx.config?.sessionTtlSeconds ?? 3600;
        token = await ctx.engine.createSessionFor(
          'subject',
          subjectRow.id,
          ttl,
        );
      }

      const subject = {
        id: subjectRow.id,
        phone,
        provider: 'phone',
        verified: true,
        ...tu.profile,
      };

      const baseResult = {
        success: true,
        message: 'Registration successful (test user)',
        status: 'su',
        subject,
        others,
      };

      return attachNewTokenIfDifferent(baseResult, undefined, token);
    }

    // Check if phone already exists
    const existingIdentity = await orm.findFirst('identities', {
      where: (b) =>
        b.and(b('provider', '=', 'phone'), b('identifier', '=', phone)),
    });

    if (existingIdentity) {
      return {
        success: false,
        message: 'Phone number already registered',
        status: 'alr',
        others,
      };
    }

    // Check password safety (HaveIBeenPwned)
    let isSafe = false;

    try {
      isSafe = await haveIbeenPawned(password);
    } catch (err) {
      console.log('haveIbeenPawned check failed', { err });
      // Decide: fail-open vs fail-closed per policy.
      isSafe = true;
    }

    if (!isSafe) {
      return {
        success: false,
        message:
          'Password has been found in data breaches. Please choose a stronger password.',
        status: 'pwr',
        others,
      };
    }

    // Create subject
    const subject = await orm.create('subjects', {});
    const subjectId = subject.id as string;

    // Create credentials (hashed password)
    const passwordHash = await hashPassword(password);
    await orm.create('credentials', {
      subject_id: subjectId,
      password_hash: passwordHash,
    });

    // Create identity
    const verified = !ctx.config?.verifyPhone;
    const identity = await orm.create('identities', {
      subject_id: subjectId,
      provider: 'phone',
      identifier: phone,
      verified,
    });

    // Handle phone verification if required
    if (ctx.config?.verifyPhone) {
      if (!ctx.config.sendCode) {
        throw new Error(
          'phone verification is on but no sendCode function provided. Please check the phone-password plugin config option',
        );
      }

      // Generate and send verification code
      const code = ctx.config.generateCode
        ? await ctx.config.generateCode(phone, { id: subjectId })
        : genCode(ctx.config);

      // Store hashed code and set expiry
      const hashedCode = await hashPassword(String(code));
      const ms = ctx.config?.verificationCodeExpiresIn ?? 30 * 60 * 1000;
      const expiresAt = new Date(Date.now() + ms);

      await orm.create('phone_identities', {
        identity_id: identity.id,
        verification_code: hashedCode,
        verification_code_expires_at: expiresAt,
      });

      // Send code
      await ctx.config.sendCode({ id: subjectId }, code, phone, 'verify');

      return {
        success: true,
        message: 'Registration successful. Please verify your phone number.',
        status: 'eq',
        subject: {
          id: subjectId,
          phone,
          provider: 'phone',
          verified: false,
        },
        others,
      };
    }

    // Create session if loginOnRegister is true
    let token: Token | null = null;
    if (ctx.config?.loginOnRegister) {
      const ttl = ctx.config?.sessionTtlSeconds ?? 3600;
      token = await ctx.engine.createSessionFor('subject', subjectId, ttl);
    }

    const baseResult = {
      success: true,
      message: 'Registration successful',
      status: 'su',
      subject: {
        id: subjectId,
        phone,
        provider: 'phone',
        verified,
      },
      others,
    };

    return attachNewTokenIfDifferent(baseResult, undefined, token);
  },
};
