import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import { findTestUser, genCode } from '../utils';
import type { PhonePasswordConfigV2 } from '../types';
import { passwordSchema, phoneSchema } from '../../../../plugins/shared/validation';
import { verifyPasswordHash, hashPassword } from '../../../../lib/password';

export type LoginInput = {
  phone: string;
  password: string;
  others?: Record<string, any>;
};

export const loginValidation = type({
  phone: 'string',
  password: passwordSchema,
  others: 'object?',
});

export const loginStep: AuthStepV2<
  LoginInput,
  AuthOutput,
  PhonePasswordConfigV2
> = {
  name: 'login',
  description: 'Authenticate user with phone and password',
  validationSchema: loginValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { unf: 401, ip: 401, su: 200, eq: 403, ic: 400 },
    },
  },
  inputs: ['phone', 'password', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'token?': 'string',
    'subject?': 'object',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { phone, password, others } = input;
    const orm = await ctx.engine.getOrm();

    // Test users first (dev/test envs)
    const tu = findTestUser(phone, password, ctx.config || {});
    if (tu) {
      const subjectRow = { id: phone };

      const ttl = ctx.config?.sessionTtlSeconds ?? 3600;

      const token = await ctx.engine.createSessionFor(
        'subject',
        subjectRow.id,
        ttl,
      );

      const subject = {
        id: subjectRow.id,
        phone,
        provider: 'phone',
        verified: true,
        ...tu.profile,
      };

      return {
        success: true,
        message: 'Login successful (test user)',
        status: 'su',
        token,
        subject,
        others,
      };
    }

    // Find identity by provider/phone
    const identity = await orm.findFirst('identities', {
      where: (b) =>
        b.and(b('provider', '=', 'phone'), b('identifier', '=', phone)),
    });

    if (!identity)
      return {
        success: false,
        message: 'Invalid phone or password',
        status: 'ip',
        others,
      };

    // defer verify-phone flow until after password verification

    // Load credentials for subject
    const creds = await orm.findFirst('credentials', {
      where: (b: any) => b('subject_id', '=', identity.subject_id),
    });

    if (!creds?.password_hash) {
      return {
        success: false,
        message: 'Password not set',
        status: 'unf',
        others,
      };
    }

    // Verify password
    const ok = await verifyPasswordHash(
      creds.password_hash as string,
      password,
    );
    if (!ok)
      return {
        success: false,
        message: 'Invalid phone or password',
        status: 'ip',
        others,
      };

    // Only after successful password verification, handle verify-phone flow
    if (ctx.config?.verifyPhone && !identity.verified) {
      if (!ctx.config.sendCode) {
        throw new Error(
          'phone verification is on but no sendCode function provided. Please check the phone-password plugin config option',
        );
      }

      // generate and send code if configured
      const code = ctx.config.generateCode
        ? await ctx.config.generateCode(phone, { id: identity.subject_id })
        : genCode(ctx.config);
      // store hash of code and set expiry (TTL)
      const hashedCode = await hashPassword(String(code));
      const ms = ctx.config?.verificationCodeExpiresIn ?? 30 * 60 * 1000;
      const expiresAt = new Date(Date.now() + ms);

      await orm.upsert('phone_identities', {
        where: (b) => b('identity_id', '=', identity.id),
        create: {
          identity_id: identity.id,
          verification_code: hashedCode,
          verification_code_expires_at: expiresAt,
        },
        update: {
          verification_code: hashedCode,
          verification_code_expires_at: expiresAt,
        },
      });

      if (ctx.config.sendCode)
        await ctx.config.sendCode(
          { id: identity.subject_id },
          code,
          phone,
          'verify',
        );
      return {
        success: false,
        message: 'Phone verification required',
        status: 'eq',
        others,
      };
    }

    const ttl = ctx.config?.sessionTtlSeconds ?? 3600;
    const token = await ctx.engine.createSessionFor(
      'subject',
      identity.subject_id as string,
      ttl,
    );

    const subject = {
      id: identity.subject_id,
      phone,
      provider: 'phone',
      verified: identity.verified,
    };
    return {
      success: true,
      message: 'Login successful',
      status: 'su',
      token,
      subject,
      others,
    };
  },
};