import { type } from 'arktype';
import { AuthPlugin, AuthStep, Entity, RootStepHooks } from '../../types';
import { hashPassword, haveIbeenPawned, verifyPasswordHash } from '../../lib';
import { createAuthPlugin } from '../utils/create-plugin';

// ArkType schemas for validation
const usernameSchema = type('string.regex|/^[a-zA-Z0-9_]{3,20}$/');
const passwordSchema = type('string.regex|/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/');

const loginSchema = type({
  username: usernameSchema,
  password: passwordSchema,
});

const registerSchema = type({
  username: usernameSchema,
  password: passwordSchema,
});

const changePasswordSchema = type({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
});

const plugin: AuthPlugin<UsernamePasswordConfig> = {
  name: 'usernameAuthPlugin',
  getSensitiveFields: () => ['password_hash'],
  steps: [
    {
      name: 'login',
      description: 'Authenticate user with username and password',
      validationSchema: loginSchema,
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
        "token?": 'string',
        "entity?": 'object',
      }),
      run: async function (input, pluginProperties) {

        const { container, config } = pluginProperties!;
        const { username, password } = input;

        const entity = await container.cradle.entityService.findEntity(
          username,
          'username',
        );

        if (!entity) {
          return { success: false, message: 'User not found', status: 'unf' };
        }

        if (!entity.password_hash) {
          return {
            success: false,
            message: 'This user does not have a password',
            status: 'unf',
          };
        }

        const passwordMatch = await verifyPasswordHash(
          entity.password_hash,
          password,
        );

        if (!passwordMatch) {
          return { success: false, message: 'Invalid password', status: 'ip' };
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
          };
        }

        const serializedEntity = container.cradle.serializeEntity(entity);

        return {
          success: true,
          message: 'Login successful',
          token: token.token,
          entity: serializedEntity,
          status: 'su',
        };
      },
      hooks: {},
      inputs: ['username', 'password'],
      protocol: {
        http: {
          method: 'POST',
          unf: 401,
          ip: 400,
          su: 200,
        },
      },
    },
    {
      name: 'register',
      description: 'Register a new user with username and password',
      validationSchema: registerSchema,
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
        "token?": 'string',
        "entity?": 'object',
      }),
      run: async function (input, pluginProperties) {

        const { container, config } = pluginProperties!;
        const { username, password } = input;

        const existingEntity = await container.cradle.entityService.findEntity(
          username,
          'username',
        );

        if (existingEntity) {
          return {
            success: false,
            message: 'Username already exists',
            status: 'ue',
          };
        }

        const safePassword = await haveIbeenPawned(password);

        if (!safePassword) {
          return {
            success: false,
            message: 'Password has been compromised in a data breach',
            status: 'ip',
          };
        }

        const entity = await container.cradle.entityService.createEntity({
          username,
          password_hash: await hashPassword(password),
        });

        const token = config.loginOnRegister
          ? await container.cradle.reAuthEngine.createSession(entity, this.name)
          : undefined;

        if (token && !token.success) {
          return {
            success: false,
            message: token.message!,
            error: token.error!,
            status: 'ic',
          };
        }

        const serializedEntity = container.cradle.serializeEntity(entity);

        return {
          success: true,
          message: 'Registration successful',
          token: token?.token,
          entity: serializedEntity,
          status: 'su',
        };
      },
      hooks: {},
      inputs: ['username', 'password'],
      protocol: {
        http: {
          method: 'POST',
          ue: 409,
          ip: 400,
          su: 201,
          ic: 400,
        },
      },
    },
    {
      name: 'change-password',
      description: 'Change user password',
      validationSchema: changePasswordSchema,
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
      }),
      run: async function (input, pluginProperties) {

        const { container } = pluginProperties!;
        const { entity, currentPassword, newPassword } = input;

        if (!entity) {
          return { success: false, message: 'Authentication required', status: 'auth' };
        }

        const currentEntity = await container.cradle.entityService.findEntity(
          entity.id,
          'id',
        );

        if (!currentEntity) {
          return { success: false, message: 'User not found', status: 'unf' };
        }

        if (!currentEntity.password_hash) {
          return {
            success: false,
            message: 'This user does not have a password',
            status: 'np',
          };
        }

        const passwordMatch = await verifyPasswordHash(
          currentEntity.password_hash,
          currentPassword,
        );

        if (!passwordMatch) {
          return { success: false, message: 'Current password is incorrect', status: 'ip' };
        }

        const safePassword = await haveIbeenPawned(newPassword);

        if (!safePassword) {
          return {
            success: false,
            message: 'New password has been compromised in a data breach',
            status: 'cp',
          };
        }

        if (currentPassword === newPassword) {
          return {
            success: false,
            message: 'New password must be different from current password',
            status: 'sp',
          };
        }

        await container.cradle.entityService.updateEntity(
          currentEntity.id,
          'id',
          {
            ...currentEntity,
            password_hash: await hashPassword(newPassword),
          },
        );

        return {
          success: true,
          message: 'Password changed successfully',
          status: 'su',
        };
      },
      hooks: {},
      inputs: ['currentPassword', 'newPassword'],
      protocol: {
        http: {
          method: 'POST',
          auth: true,
          ip: 400,
          su: 200,
          unf: 401,
        },
      },
    },
  ],
  initialize: async function (container) {
    // TODO: Username plugin is not yet complete. Missing features:
    // - Comprehensive testing and validation
    // - Username validation security assessment
    // - Rate limiting for login attempts
    // - Account lockout mechanisms
    // - Password policy enforcement testing
    // - Integration testing with other plugins
    // - Documentation completion and review
    // - Performance optimization for auth flows
    // - Security audit for password handling
    // - Username uniqueness constraint testing
    // - Multi-environment configuration support
    // - Brute force protection validation
    throw new Error('Username plugin is not yet ready for production use. This is a work in progress.');

    // This code will be enabled when the plugin is ready:
    /*
    this.container = container;
    */
  },
  migrationConfig: {
    pluginName: 'username-password',
    extendTables: [
      {
        tableName: 'entities',
        columns: {
          username: {
            type: 'string',
            nullable: true,
            unique: true,
            index: true,
            length: 50,
          },
          password_hash: {
            type: 'string',
            nullable: true,
          },
        },
      },
    ],
  },
  config: {},
};

const usernamePasswordAuth = (
  config: UsernamePasswordConfig = {},
  overrideStep?: {
    name: string;
    override: Partial<AuthStep<UsernamePasswordConfig>>;
  }[],
): AuthPlugin<UsernamePasswordConfig> => {
  return createAuthPlugin(config, plugin, overrideStep, {
    loginOnRegister: true,
  });
};

export default usernamePasswordAuth;

declare module '../../types' {
  interface EntityExtension {
    username?: string;
  }
}

interface UsernamePasswordConfig {
  /**
   * @default true
   * Whether to login the user after registration
   */
  loginOnRegister?: boolean;
  /**
   * Root hooks
   * @example
   * rootHooks: {
   *  before: async (input, pluginProperties) => {
   *    // do something before the plugin runs
   *  }
   */
  rootHooks?: RootStepHooks;
} 

