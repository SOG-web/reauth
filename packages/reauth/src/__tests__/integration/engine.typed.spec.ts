import { describe, it, expect, expectTypeOf } from 'vitest';
import createReAuthEngine from '../../engine';
import {
  type AuthPlugin,
  type AuthOutput,
  type FumaClient,
  type OrmLike,
  type AuthStep,
  type AuthInput,
  tokenType,
  Token,
} from '../../types';
import { type } from 'arktype';
import { PhonePasswordConfig } from '../../plugins/phone/types';
import { passwordSchema } from '../../plugins/shared/validation';

type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
  others?: Record<string, any>;
  token: Token;
};

type ChangePasswordOutput = {
  success: boolean;
  message: string;
  error?: string | object;
  status: string;
  others?: Record<string, any>;
  token?: Token;
};

const changePasswordValidation = type({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
  'others?': 'object | undefined',
  token: tokenType,
});

const changePasswordStep: AuthStep<
  PhonePasswordConfig,
  'change-password',
  ChangePasswordInput,
  ChangePasswordOutput
> = {
  name: 'change-password',
  description: 'Change password for authenticated user',
  validationSchema: changePasswordValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ip: 401, pwr: 400, unauth: 401 },
      auth: true,
    },
  },
  inputs: ['currentPassword', 'newPassword', 'others', 'token'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'others?': 'object | undefined',
    'token?': tokenType,
  }),
  async run(input, ctx) {
    // input is now typed as ChangePasswordInput!
    const { currentPassword, newPassword, others, token } = input;
    const orm = await ctx.engine.getOrm();

    const session = await ctx.engine.checkSession(token || '');
    if (!session.subject) {
      return {
        success: false,
        message: 'Authentication required',
        status: 'unauth',
        others,
      }; // TypeScript validates this matches ChangePasswordOutput!
    }

    // ... rest of your implementation

    return {
      success: true,
      message: 'Password changed successfully',
      status: 'su',
      others,
    };
  },
};

type RegisterStepInput = {
  phoneNumber: string;
  password: string;
  others?: Record<string, any>;
};

type RegisterStepOutput = {
  success: boolean;
  message: string;
  error?: string | object;
  status: string;
  others?: Record<string, any>;
  token?: Token;
};

const registerStepValidation = type({
  phoneNumber: 'string',
  password: passwordSchema,
  'others?': 'object | undefined',
});

const registerStep: AuthStep<
  PhonePasswordConfig,
  'register',
  RegisterStepInput,
  RegisterStepOutput
> = {
  name: 'register',
  description: 'Register a new user with phone number and password',
  validationSchema: registerStepValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ip: 400, error: 500 },
      auth: false,
    },
  },
  inputs: ['phoneNumber', 'password', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'others?': 'object | undefined',
    'token?': tokenType,
  }),
  async run(input, ctx) {
    // input is now typed as RegisterStepInput!
    const { phoneNumber, password, others } = input;
    const orm = await ctx.engine.getOrm();

    // ... rest of your implementation

    return {
      success: true,
      message: 'User registered successfully',
      status: 'su',
      others,
    };
  },
};

const phonePasswordPlugin = {
  name: 'phone-password' as const,
  config: {} as PhonePasswordConfig,
  steps: [
    changePasswordStep,
    registerStep,
    // ... other steps
  ],
} satisfies AuthPlugin<PhonePasswordConfig, 'phone-password'>;

const createMockDbClient = (): FumaClient => {
  const orm = {
    create: async () => ({}),
    findFirst: async () => null,
    findMany: async () => [],
    update: async () => ({}),
    delete: async () => ({}),
  };

  return {
    async version() {
      return 'mock-version';
    },
    orm() {
      return orm as unknown as OrmLike;
    },
  };
};

describe('ReAuthEngine plugin name typing', () => {
  const buildEngine = () =>
    createReAuthEngine({
      dbClient: createMockDbClient(),
      plugins: [phonePasswordPlugin],
      getUserData: async () => ({}),
      enableCleanupScheduler: false,
      authHooks: [],
      sessionHooks: [],
    });

  it('narrows plugin names to provided plugins', async () => {
    const engine = buildEngine();

    type PluginName = Parameters<(typeof engine)['executeStep']>[0];
    expectTypeOf<PluginName>().toEqualTypeOf<'phone-password'>();

    const phonePassword = await engine.executeStep(
      'phone-password',
      'change-password',
      {
        currentPassword: '',
        newPassword: '',
        token: null,
      },
    );

    expectTypeOf(phonePassword).toEqualTypeOf<ChangePasswordOutput>();
    expect(phonePassword.message).toBe('Password changed successfully');

    const register = await engine.executeStep('phone-password', 'register', {
      phoneNumber: '1234567890',
      password: 'password123',
      others: {
        device: 'mobile',
      },
    });

    expectTypeOf(register).toEqualTypeOf<RegisterStepOutput>();
    expect(register.message).toBe('User registered successfully');
  });

  it('narrows helper methods to provided plugin names', () => {
    const engine = buildEngine();

    const plugin = engine.getPlugin('phone-password');
    expect(plugin).toBeDefined();
    expect(plugin?.name).toBe('phone-password');
  });
});
