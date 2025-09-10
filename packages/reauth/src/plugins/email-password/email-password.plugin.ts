import { type } from 'arktype';
import { AuthPlugin, AuthStep, Entity, RootStepHooks } from '../../types';
import { hashPassword, haveIbeenPawned, verifyPasswordHash } from '../../lib';
import {
  createAuthPlugin,
  createAuthPluginLegacy,
} from '../utils/create-plugin';
import { passwordSchema } from '../shared/validation';

const loginSchema = type({
  email: 'string.email',
  password: passwordSchema,
  others: 'object?',
});

// Helper function to check if environment supports test users
const isTestEnvironmentAllowed = (config: EmailPasswordConfig): boolean => {
  if (!config.testUsers?.enabled) return false;

  const env = config.testUsers.environment || 'development';
  if (env === 'all') return true;

  const nodeEnv = process.env.NODE_ENV;
  return (
    env === nodeEnv ||
    (env === 'development' && (!nodeEnv || nodeEnv === 'development'))
  );
};

// Helper function to find test user
const findTestUser = (
  email: string,
  password: string,
  config: EmailPasswordConfig,
): TestUser | null => {
  if (!isTestEnvironmentAllowed(config)) return null;

  return (
    config.testUsers?.users.find(
      (user) => user.email === email && user.password === password,
    ) || null
  );
};

// Helper function to create test entity
const createTestEntity = (testUser: TestUser): Entity => {
  const baseEntity = {
    id: `test-user-${testUser.email}`,
    role: 'user',
    created_at: new Date(),
    updated_at: new Date(),
    email: testUser.email,
    email_verified: true,
    password_hash: 'test-hash',
    ...testUser.profile,
  } as Entity;

  return baseEntity;
};

const plugin: AuthPlugin<EmailPasswordConfig> = {
  name: 'email',
  getSensitiveFields: () => [
    'password_hash',
    'email_verification_code',
    'reset_password_code',
    'reset_password_code_expires_at',
  ],
  steps: [
    {
      name: 'login',
      description: 'Authenticate user with email and password',
      validationSchema: loginSchema,
      run: async function (input, pluginProperties) {
        const { container, config } = pluginProperties!;
        const { email, password, others } = input;

        // Check for test user first
        const testUser = findTestUser(email, password, config);
        if (testUser) {
          const testEntity = createTestEntity(testUser);

          const token = await container.cradle.reAuthEngine.createSession(
            testEntity,
            this.name,
          );

          if (!token.success) {
            return {
              success: false,
              message: token.message!,
              error: token.error!,
              status: 'ic',
              others,
            };
          }

          // Create a copy of the entity with sensitive fields redacted
          const serializedEntity = container.cradle.serializeEntity(testEntity);

          return {
            success: true,
            message: 'Login successful (test user)',
            token: token.token,
            entity: serializedEntity,
            others,
            status: 'su',
          };
        }

        const entity = await container.cradle.entityService.findEntity(
          email,
          'email',
        );

        if (!entity) {
          return {
            success: false,
            message: 'User not found',
            status: 'unf',
            others,
          };
        }

        if (config.verifyEmail && !entity.email_verified) {
          if (!config.sendCode) {
            throw new Error('No send code function provided');
          }

          if (!config.generateCode) {
            throw new Error('No generate code function');
          }

          const code = await config.generateCode(entity.email!, entity);

          await container.cradle.entityService.updateEntity(
            entity.email!,
            'email',
            {
              ...entity,
              email_verification_code: code,
            },
          );

          await config.sendCode(entity, code, entity.email!, 'verify');

          return {
            success: false,
            message: 'User Email verification is requred',
            status: 'eq',
            others,
          };
        }

        if (!entity.password_hash) {
          return {
            success: false,
            message: 'This user does not have a password',
            status: 'unf',
            others,
          };
        }

        const passwordMatch = await verifyPasswordHash(
          entity.password_hash,
          password,
        );

        if (!passwordMatch) {
          return {
            success: false,
            message: 'Invalid password',
            status: 'ip',
            others,
          };
        }

        const token = await container.cradle.reAuthEngine.createSession(
          entity,
          this.name,
        );

        if (!token.success) {
          return {
            success: false,
            message: token.message!,
            error: token.error!,
            status: 'ic',
            others,
          };
        }

        // Create a copy of the entity with sensitive fields redacted
        const serializedEntity = container.cradle.serializeEntity(entity);

        return {
          success: true,
          message: 'Login successful',
          token: token.token,
          entity: serializedEntity,
          others,
          status: 'su',
        };
      },
      outputs: type({
        success: 'boolean',
        message: 'string',
        'error?': 'string | object',
        status: 'string',
        'token?': 'string',
        'entity?': 'object',
      }),
      hooks: {},
      inputs: ['email', 'password', 'others'],
      protocol: {
        http: {
          method: 'POST',
          unf: 401,
          ip: 400,
          su: 200,
          eq: 300,
          ic: 400,
        },
      },
    },
    {
      name: 'register',
      description: 'Register a new user with email and password',
      validationSchema: loginSchema,
      run: async function (input, pluginProperties) {
        const { container, config } = pluginProperties!;
        const { email, password, others } = input;

        // Check for test user registration
        const testUser = findTestUser(email, password, config);
        if (testUser) {
          const testEntity = createTestEntity(testUser);

          const token = config.loginOnRegister
            ? await container.cradle.reAuthEngine.createSession(
                testEntity,
                this.name,
              )
            : undefined;

          if (token && !token.success) {
            return {
              success: false,
              message: token.message!,
              error: token.error!,
              status: 'ic',
              others,
            };
          }

          const serializedEntity = container.cradle.serializeEntity(testEntity);

          return {
            success: true,
            message: 'Register successful (test user)',
            token: token?.token,
            entity: serializedEntity,
            others,
            status: 'su',
          };
        }

        const en = await container.cradle.entityService.findEntity(
          email,
          'email',
        );

        if (en) {
          return {
            success: false,
            message: 'User already exist',
            status: 'ip',
            others,
          };
        }

        const savePassword = await haveIbeenPawned(password);

        if (!savePassword) {
          return {
            success: false,
            message: 'Password has been pawned',
            status: 'ip',
            others,
          };
        }

        const entity = await container.cradle.entityService.createEntity({
          email,
          password_hash: await hashPassword(password),
          email_verified: false,
        });

        if (config.verifyEmail) {
          if (!config.sendCode) {
            throw new Error('No send code function provided');
          }

          if (!config.generateCode) {
            throw new Error('No generate code function');
          }

          const code = await config.generateCode(entity.email!, entity);

          await container.cradle.entityService.updateEntity(
            entity.email!,
            'email',
            {
              ...entity,
              email_verification_code: code,
            },
          );

          await config.sendCode(entity, code, entity.email!, 'verify');
        }

        const token = config.loginOnRegister
          ? await container.cradle.reAuthEngine.createSession(entity, this.name)
          : undefined;

        if (token && !token.success) {
          return {
            success: false,
            message: token.message!,
            error: token.error!,
            status: 'ic',
            others,
          };
        }

        const serializedEntity = container.cradle.serializeEntity(entity);

        return {
          success: true,
          message: 'Register successful',
          token: token?.token,
          entity: serializedEntity,
          others,
          status: 'su',
        };
      },
      hooks: {},
      inputs: ['email', 'password', 'others'],
      protocol: {
        http: {
          method: 'POST',
          ip: 400,
          su: 200,
          ic: 400,
        },
      },
    },
    {
      name: 'verify-email',
      description: 'Verify email',
      validationSchema: type({
        email: 'string.email',
        code: 'number.safe | string',
        others: 'object?',
      }),
      run: async (input, pluginProperties) => {
        const { container } = pluginProperties!;
        const { email, code, others } = input;

        const entity = await container.cradle.entityService.findEntity(
          email,
          'email',
        );

        if (!entity) {
          return {
            success: false,
            message: 'User not found',
            status: 'unf',
            others,
          };
        }

        if (entity.email_verified) {
          return {
            success: true,
            message: 'Email already verified',
            status: 'su',
            others,
          };
        }

        if (entity.email_verification_code !== code) {
          return {
            success: false,
            message: 'Invalid code',
            status: 'ic',
            others,
          };
        }

        entity.email_verified = true;
        entity.email_verification_code = undefined;
        await container.cradle.entityService.updateEntity(
          entity.email!,
          'email',
          entity,
        );

        return {
          success: true,
          message: 'Email verified',
          status: 'su',
          others,
        };
      },
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
      }),
      hooks: {},
      inputs: ['email', 'code', 'others'],
      protocol: {
        http: {
          method: 'POST',
          ic: 400,
          su: 200,
          unf: 401,
        },
      },
    },
    {
      name: 'resend-verify-email',
      description: 'Resend verify email',
      validationSchema: type({
        email: 'string.email',
        others: 'object?',
      }),
      run: async (input, pluginProperties) => {
        const { container, config } = pluginProperties!;
        const { email, others } = input;

        const entity = await container.cradle.entityService.findEntity(
          email,
          'email',
        );

        if (!entity) {
          return {
            success: false,
            message: 'User not found',
            status: 'unf',
            others,
          };
        }

        if (entity.email_verified) {
          return {
            success: true,
            message: 'Email already verified',
            status: 'su',
            others,
          };
        }

        if (!config.generateCode) {
          throw new Error('No generate code function');
        }

        const code = await config.generateCode(entity.email!, entity);

        await container.cradle.entityService.updateEntity(
          entity.email!,
          'email',
          {
            ...entity,
            email_verification_code: code,
          },
        );

        if (!config.sendCode) {
          throw new Error('No send code function provided');
        }

        await config.sendCode(entity, code, entity.email!, 'verify');

        return {
          success: true,
          message: 'Verification code resent',
          status: 'su',
          others,
        };
      },
      hooks: {},
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
      }),
      inputs: ['email', 'others'],
      protocol: {
        http: {
          method: 'POST',
          nc: 400,
          su: 200,
          unf: 401,
        },
      },
    },
    {
      name: 'send-reset-password',
      description: 'Send reset password',
      validationSchema: type({
        email: 'string.email',
        others: 'object?',
      }),
      run: async (input, pluginProperties) => {
        const { container, config } = pluginProperties!;
        const { email, others } = input;

        const entity = await container.cradle.entityService.findEntity(
          email,
          'email',
        );

        if (!entity) {
          return {
            success: false,
            message: 'User not found',
            status: 'unf',
            others,
          };
        }

        if (!entity.email_verified && !config.verifyEmail) {
          return {
            success: false,
            message: 'Email not verified',
            status: 'ev',
            others,
          };
        }

        if (!config.sendCode) {
          throw new Error('No send code function provided');
        }

        if (!config.generateCode) {
          throw new Error('No generate code function');
        }

        const code = await config.generateCode(entity.email!, entity);

        await container.cradle.entityService.updateEntity(
          entity.email!,
          'email',
          {
            ...entity,
            reset_password_code: code,
            reset_password_code_expires_at: new Date(
              Date.now() +
                (config.resetPasswordCodeExpiresIn || 30 * 60 * 1000),
            ),
          },
        );

        await config.sendCode(entity, code, entity.email!, 'reset');

        return {
          success: true,
          message: 'Reset password code sent',
          status: 'su',
          others,
        };
      },
      hooks: {},
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
      }),
      inputs: ['email', 'others'],
      protocol: {
        http: {
          method: 'POST',
          ev: 400,
          su: 200,
          unf: 401,
        },
      },
    },
    {
      name: 'reset-password',
      description: 'Reset password',
      validationSchema: type({
        email: 'string.email',
        password: passwordSchema,
        code: 'number.safe | string',
        others: 'object?',
      }),
      run: async (input, pluginProperties) => {
        const { container } = pluginProperties!;
        const { email, password, code, others } = input;

        const entity = await container.cradle.entityService.findEntity(
          email,
          'email',
        );

        if (!entity) {
          return {
            success: false,
            message: 'User not found',
            status: 'unf',
            others,
          };
        }

        const savePassword = await haveIbeenPawned(password);

        if (!savePassword) {
          return {
            success: false,
            message: 'Password has been pawned',
            status: 'ip',
            others,
          };
        }

        if (
          entity.reset_password_code !== code ||
          entity.reset_password_code_expires_at! < new Date()
        ) {
          await container.cradle.entityService.updateEntity(
            entity.email!,
            'email',
            {
              ...entity,
              reset_password_code: undefined,
              reset_password_code_expires_at: undefined,
            },
          );
          return {
            success: false,
            message: 'Invalid code',
            status: 'ic',
            others,
          };
        }

        await container.cradle.entityService.updateEntity(
          entity.email!,
          'email',
          {
            ...entity,
            password_hash: await hashPassword(password),
            reset_password_code: undefined,
            reset_password_code_expires_at: undefined,
          },
        );

        return {
          success: true,
          message: 'Password reset successful',
          status: 'su',
          others,
        };
      },
      hooks: {},
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
      }),
      inputs: ['email', 'password', 'code', 'others'],
      protocol: {
        http: {
          method: 'POST',
          ic: 400,
          ip: 400,
          su: 200,
          unf: 401,
        },
      },
    },
  ],
  initialize: async function (container) {
    this.container = container;
  },
  migrationConfig: {
    pluginName: 'email-password',
    extendTables: [
      {
        tableName: 'entities',
        columns: {
          email: {
            type: 'string',
            nullable: false,
            unique: true,
            index: true,
          },
          email_verified: {
            type: 'boolean',
            index: true,
            defaultValue: true,
          },
          password_hash: {
            type: 'string',
            unique: true,
            nullable: true,
          },
          email_verification_code: {
            type: 'string',
            nullable: true,
          },
          reset_password_code: {
            type: 'string',
            nullable: true,
          },
          reset_password_code_expires_at: {
            type: 'timestamp',
            nullable: true,
          },
        },
      },
    ],
  },
  config: {},
};

const emailPasswordAuth = (
  config: EmailPasswordConfig = {},
  overrideStep?: {
    name: string;
    override: Partial<AuthStep<EmailPasswordConfig>>;
  }[],
): AuthPlugin<EmailPasswordConfig> => {
  return createAuthPluginLegacy(config, plugin, overrideStep, {
    verifyEmail: false,
    loginOnRegister: true,
    codeLenght: 4,
    generateCode: async function (email, entity) {
      if (this.codeType === 'numeric') {
        return Array(this.codeLenght!)
          .fill(0)
          .map(() => String.fromCharCode(48 + Math.floor(Math.random() * 10)))
          .join('');
      }

      if (this.codeType === 'alphanumeric') {
        return Array(this.codeLenght!)
          .fill(0)
          .map(() =>
            String.fromCharCode(
              48 + Math.floor(Math.random() * (122 - 48 + 1)) + 48,
            ),
          )
          .join('');
      }

      if (this.codeType === 'alphabet') {
        return Array(this.codeLenght!)
          .fill(0)
          .map(() =>
            String.fromCharCode(
              97 + Math.floor(Math.random() * (122 - 97 + 1)) + 97,
            ),
          )
          .join('');
      }

      return Array(this.codeLenght!)
        .fill(0)
        .map(() =>
          String.fromCharCode(
            48 + Math.floor(Math.random() * (122 - 48 + 1)) + 48,
          ),
        )
        .join('');
    },
    resetPasswordCodeExpiresIn: 30 * 60 * 1000,
    codeType: 'numeric',
  });
};

export default emailPasswordAuth;

// Export helper functions for testing and external use
export { isTestEnvironmentAllowed, findTestUser, createTestEntity };

declare module '../../types' {
  interface EntityExtension {
    email: string | null;
    password_hash: string | null;
    email_verified: boolean;
    email_verification_code?: string | number | null;
    reset_password_code?: string | number | null;
    reset_password_code_expires_at?: Date | null;
  }
}

export interface EmailPasswordConfig {
  /**
   * @default false
   * Whether to verify the email after registration
   */
  verifyEmail?: boolean;
  /**
   * @default true
   * Whether to login the user after registration
   */
  loginOnRegister?: boolean;
  /**
   * @default 'numeric'
   * @options 'numeric' | 'alphanumeric' | 'alphabet'
   */
  codeType?: 'numeric' | 'alphanumeric' | 'alphabet';
  /**
   * @default 4
   */
  codeLenght?: number;
  /**
   * Send function
   * @param entity The entity to send the code to
   * @param code The code to send
   * @param email The email to send the code to
   * @param type The type of code to send (verify or reset)
   * @returns Promise<void>
   * @example
   * sendCode: async (entity, code, email, type) => {
   *  if (type === 'verify') {
   *    // the code should be your frontend url or your backend url + /verify-email?code=${code}&email=${email}
   *    await sendVerifyEmail(entity, code, email);
   *  } else {
   *    // the code should be your frontend url + /reset-password?code=${code}&email=${email}
   *    await sendResetPasswordEmail(entity, code, email);
   *  }
   * }
   */
  sendCode?: (
    entity: Partial<Entity>,
    code: string | number,
    email: string,
    type: 'verify' | 'reset',
  ) => Promise<void>;
  /**
   * Generate code function
   * @param email The email to generate the code for
   * @param entity The entity to generate the code for
   * @returns Promise<string | number>
   * @example
   * generateCode: async (email, entity) => {
   *  return Math.random().toString(36).slice(-6);
   * }
   */
  generateCode?: (email: string, entity?: Entity) => Promise<string | number>;
  /**
   * @default 30 * 60 * 1000
   * should be in milliseconds
   */
  resetPasswordCodeExpiresIn?: number;

  /**
   * Root hooks
   * @example
   * rootHooks: {
   *  before: async (input, pluginProperties) => {
   *    // do something before the plugin runs
   *  }
   */
  rootHooks?: RootStepHooks;

  /**
   * Test user configuration for development/testing
   */
  testUsers?: TestUserConfig;
}

export interface TestUser {
  email: string;
  password: string;
  profile: Record<string, any>; // More flexible than Partial<Entity>
}

export interface TestUserConfig {
  /**
   * @default false
   * Whether test users are enabled
   */
  enabled: boolean;
  /**
   * Array of test user configurations
   */
  users: TestUser[];
  /**
   * @default 'development'
   * Environment where test users are allowed
   */
  environment?: 'development' | 'test' | 'all';
}

//TODO: use change password step as an example on the docs
