import { AuthPlugin, AuthStep, Entity, RootStepHooks } from '../../types';
import {
  createAuthPlugin,
  createAuthPluginLegacy,
} from '../utils/create-plugin';
import { hashPassword, haveIbeenPawned, verifyPasswordHash } from '../../lib';
import { type } from 'arktype';
import { passwordSchema, phoneSchema } from '../shared/validation';

const loginValidation = type({
  phone: phoneSchema,
  password: passwordSchema,
  others: 'object?',
});

const plugin: AuthPlugin<PhonePasswordConfig> = {
  name: 'phone',
  getSensitiveFields: () => [
    'phone_verification_code_expires_at',
    'phone_verification_code',
  ],
  steps: [
    {
      name: 'login',
      description: 'Authenticate user with phone and password',
      validationSchema: loginValidation,
      run: async function (input, pluginProperties) {
        const { container, config } = pluginProperties!;
        const { phone, password, others } = input;

        const entity = await container.cradle.entityService.findEntity(
          phone,
          'phone',
        );

        if (!entity) {
          return {
            success: false,
            message: 'User not found',
            status: 'unf',
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

        if (config.verifyPhone && !entity.phone_verified) {
          return {
            success: false,
            message: 'Phone not verified',
            status: 'ev',
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

        const serializedEntity = container.cradle.serializeEntity(entity);

        return {
          success: true,
          message: 'Login successful',
          token: token.token,
          entity: serializedEntity,
          status: 'su',
          others,
        };
      },
      hooks: {},
      inputs: ['phone', 'password', 'others'],
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
        token: 'string',
        entity: 'object',
      }),
      protocol: {
        http: {
          method: 'POST',
          unf: 401,
          ip: 400,
          ic: 400,
          su: 200,
          ev: 400,
        },
      },
    },
    {
      name: 'register',
      description: 'Register a new user with phone and password',
      validationSchema: loginValidation,
      run: async function (input, pluginProperties) {
        const { container, config } = pluginProperties!;
        const { phone, password, others } = input;

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
          phone,
          password_hash: await hashPassword(password),
        });

        if (config.verifyPhone) {
          if (!config.generateCode) {
            throw new Error('No generate code function provided');
          }

          if (!config.sendCode) {
            throw new Error('No send code function provided');
          }

          const code = config.generateCode(entity);

          await container.cradle.entityService.updateEntity(
            entity.phone!,
            'phone',
            {
              ...entity,
              phone_verification_code: code,
              phone_verification_code_expires_at: new Date(
                Date.now() +
                  (config.expireTime
                    ? (config.expireTime as any).split('m')[0] * 60 * 1000
                    : 0),
              ),
            },
          );

          await config.sendCode(entity, code, entity.phone!);

          return {
            success: true,
            message: 'Phone verification code sent',
            status: 'su',
            others,
          };
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
          status: 'su',
          others,
        };
      },
      hooks: {},
      inputs: ['phone', 'password', 'others'],
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
        token: 'string',
        entity: 'object',
      }),
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
      name: 'verify-phone',
      description: 'Verify phone',
      validationSchema: type({
        phone: phoneSchema,
        code: 'string',
        others: 'object?',
      }),
      run: async function (input, pluginProperties) {
        const { container } = pluginProperties!;
        const { phone, code, others } = input;

        const entity = await container.cradle.entityService.findEntity(
          phone,
          'phone',
        );

        if (!entity) {
          return {
            success: false,
            message: 'User not found',
            status: 'unf',
            others,
          };
        }

        if (entity.phone_verified) {
          return {
            success: true,
            message: 'Phone already verified',
            status: 'su',
            others,
          };
        }

        if (entity.phone_verification_code !== code) {
          return {
            success: false,
            message: 'Invalid code',
            status: 'ic',
            others,
          };
        }

        await container.cradle.entityService.updateEntity(
          entity.phone!,
          'phone',
          {
            ...entity,
            phone_verified: true,
            phone_verification_code: undefined,
          },
        );

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

        const serializedEntity = container.cradle.serializeEntity(entity);

        return {
          success: true,
          message: 'Phone verified',
          token: token.token,
          entity: serializedEntity,
          status: 'su',
          others,
        };
      },
      hooks: {},
      inputs: ['phone', 'code', 'others'],
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
        token: 'string',
        entity: 'object',
      }),
      protocol: {
        http: {
          method: 'POST',
          unf: 401,
          ic: 400,
          su: 200,
        },
      },
    },
    //TODO: add change phone step(this block since auth checking within plugin not yet finalized)
    {
      name: 'password-reset',
      description: 'Reset password',
      validationSchema: type({
        phone: phoneSchema,
        others: 'object?',
      }),
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
      }),
      hooks: {},
      inputs: ['phone', 'others'],
      run: async (input, pluginProperties) => {
        const { container, config } = pluginProperties!;
        const { phone, others } = input;

        const entity = await container.cradle.entityService.findEntity(
          phone,
          'phone',
        );

        if (!entity) {
          return {
            success: false,
            message: 'User not found',
            status: 'unf',
            others,
          };
        }

        if (!entity.phone_verified) {
          return {
            success: false,
            message: 'Phone not verified',
            status: 'ev',
            others,
          };
        }

        if (!config.generateCode) {
          throw new Error('No generate code function provided');
        }
        if (!config.sendCode) {
          throw new Error('No send code function provided');
        }
        const code = config.generateCode(entity);
        await config.sendCode(entity, code, entity.phone!);

        const expireTime =
          config.expireTime &&
          (config.expireTime as any).split('m')[0] * 60 * 1000;

        await container.cradle.entityService.updateEntity(
          entity.phone!,
          'phone',
          {
            ...entity,
            reset_password_code: code,
            reset_password_code_expires_at: new Date(
              Date.now() + (expireTime || 0),
            ),
          },
        );

        return {
          success: true,
          message: 'Reset code sent',
          status: 'su',
          others,
        };
      },
      protocol: {
        http: {
          method: 'POST',
          unf: 401,
          ev: 400,
          su: 200,
        },
      },
    },
  ],
  initialize: async function (container) {
    this.container = container;
  },
  migrationConfig: {
    pluginName: 'phone-password',
    extendTables: [
      {
        tableName: 'entities',
        columns: {
          phone: {
            type: 'string',
            nullable: false,
            unique: true,
            index: true,
          },
          phone_verified: {
            type: 'boolean',
            index: true,
            defaultValue: true,
          },
          phone_verification_code: {
            type: 'string',
            nullable: true,
          },
          phone_verification_code_expires_at: {
            type: 'timestamp',
            nullable: true,
          },
        },
      },
    ],
  },
  config: {},
};

/**
 * Phone password authentication plugin
 * @param config Configuration for the phone password plugin
 * @param overrideStep Optional array of step overrides
 * @throws {Error} If required configuration is missing
 */
export default function phonePasswordAuth(
  config: PhonePasswordConfig,
  overrideStep?: {
    name: string;
    override: Partial<AuthStep<PhonePasswordConfig>>;
  }[],
): AuthPlugin<PhonePasswordConfig> {
  if (!config.sendCode) {
    throw new Error('sendCode function is required for phone-password plugin');
  }

  return createAuthPluginLegacy(config, plugin, overrideStep, {
    verifyPhone: false,
    loginOnRegister: true,
    expireTime: '10m',
    codeLength: 4,
    codeType: 'numeric',
    generateCode: function (entity) {
      if (this.codeType === 'numeric') {
        return Array(this.codeLength!)
          .fill(0)
          .map(() => String.fromCharCode(48 + Math.floor(Math.random() * 10)))
          .join('');
      }

      if (this.codeType === 'alphanumeric') {
        return Array(this.codeLength!)
          .fill(0)
          .map(() =>
            String.fromCharCode(
              48 + Math.floor(Math.random() * (122 - 48 + 1)) + 48,
            ),
          )
          .join('');
      }

      if (this.codeType === 'alphabet') {
        return Array(this.codeLength!)
          .fill(0)
          .map(() =>
            String.fromCharCode(
              97 + Math.floor(Math.random() * (122 - 97 + 1)) + 97,
            ),
          )
          .join('');
      }

      return Array(this.codeLength!)
        .fill(0)
        .map(() => String.fromCharCode(48 + Math.floor(Math.random() * 10)))
        .join('');
    },
  });
}

export interface PhonePasswordConfig {
  /**
   * @default false
   */
  verifyPhone?: boolean;
  /**
   * @default true
   */
  loginOnRegister?: boolean;
  /**
   * @default '10m'
   * should be in minutes
   * @example '10m'
   */
  expireTime?: string;
  /**
   * @default 4
   * @example 4
   * should be between 4 and 10
   */
  codeLength?: number;
  /**
   * @default 'numeric'
   * @example 'numeric'
   * @options 'numeric' | 'alphanumeric' | 'alphabet'
   */
  codeType?: 'numeric' | 'alphanumeric' | 'alphabet';
  /**
   * @example
   * ```ts
   * generateCode: (entity: Entity) => string;
   * ```
   */
  generateCode?: (entity: Entity) => string;
  /**
   * Function to send verification code to the user's phone
   * @example
   * ```ts
   * sendCode: async (entity, code, phone) => {
   *   // Implement your SMS sending logic here
   *   await sendSms(phone, `Your verification code is: ${code}`);
   * }
   * ```
   * @throws {Error} If not provided - this is a required configuration
   */
  sendCode: (entity: Entity, code: string, phone: string) => Promise<void>;
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

declare module '../../types' {
  interface EntityExtension {
    phone?: string | null;
    phone_verified?: boolean;
    phone_verification_code?: string | number | null;
    phone_verification_code_expires_at?: Date | null;
  }
}
