import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { EmailPasswordConfigV2 } from '../types';
import { haveIbeenPawned, hashPassword } from '../../../../lib/password';
import { passwordSchema } from '../../../../plugins/shared/validation';
import { genCode, findTestUser } from '../utils';

export type RegisterInput = {
  email: string;
  password: string;
  others?: Record<string, any>;
};

export const registerValidation = type({
  email: 'string.email',
  password: passwordSchema,
  others: 'object?',
});

export const registerStep: AuthStepV2<
  RegisterInput,
  AuthOutput,
  EmailPasswordConfigV2
> = {
  name: 'register',
  description: 'Register a new user with email and password',
  validationSchema: registerValidation,
  protocol: { http: { method: 'POST', codes: { ip: 400, su: 200, ic: 400 } } },
  inputs: ['email', 'password', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'token?': 'string',
    'subject?': 'object',
  }),
  async run(input, ctx) {
    const { email, password, others } = input;
    const orm = await ctx.engine.getOrm();

    // Test user registration (parity with V1)
    const tu = findTestUser(email, password, ctx.config || ({} as any));
    if (tu) {
      const subject = { id: email };
      const loginOnRegister = ctx.config?.loginOnRegister ?? true;
      const ttl = ctx.config?.sessionTtlSeconds ?? 3600;
      const token = loginOnRegister
        ? await ctx.engine.createSessionFor(
            'subject',
            subject.id as string,
            ttl,
          )
        : undefined;
      const outSubject = {
        id: subject.id,
        email,
        provider: 'email',
        verified: true,
        ...tu.profile,
      };
      return {
        success: true,
        message: 'Register successful (test user)',
        status: 'su',
        token,
        subject: outSubject,
        others,
      };
    }

    if (ctx.config?.verifyEmail && !ctx.config.sendCode) {
      throw new Error(
        'email verification is on but no sendCode function provider. Please check the email-password plugin config option',
      );
    }

    const existing = await orm.findFirst('identities', {
      where: (b) =>
        b.and(b('provider', '=', 'email'), b('identifier', '=', email)),
    });

    if (existing)
      return {
        success: false,
        message: 'User already exist',
        status: 'ip',
        others,
      };

    const safePassword = await haveIbeenPawned(password);

    if (!safePassword)
      return {
        success: false,
        message: 'Password has been pawned',
        status: 'ip',
        others,
      };

    const subject = await orm.create('subjects', {});
    await orm.create('credentials', {
      subject_id: subject.id,
      password_hash: await hashPassword(password),
    });

    const identity = await orm.create('identities', {
      subject_id: subject.id,
      provider: 'email',
      identifier: email,
      verified: false,
    });

    if (ctx.config?.verifyEmail && ctx.config.sendCode) {
      const code = ctx.config?.generateCode
        ? await ctx.config.generateCode(email, { id: subject.id })
        : genCode(ctx.config);
      await orm.create('email_identities', {
        identity_id: identity.id,
        verification_code: code,
      });

      await ctx.config.sendCode({ id: subject.id }, code, email, 'verify');
    }

    const loginOnRegister = ctx.config?.loginOnRegister ?? true;
    const ttl = ctx.config?.sessionTtlSeconds ?? 3600;
    const token = loginOnRegister
      ? await ctx.engine.createSessionFor('subject', subject.id as string, ttl)
      : undefined;

    const outSubject = {
      id: subject.id,
      email,
      provider: 'email',
      verified: false,
    };
    return {
      success: true,
      message: 'Register successful',
      status: 'su',
      token,
      subject: outSubject,
      others,
    };
  },
};
