// a plugin for getting current user

import { type } from 'arktype';
import type { AuthPlugin, AuthStep, RootStepHooks } from '../../types';
import { createAuthPlugin } from '../utils';

const plugin: AuthPlugin<SessionPluginConfig> = {
  name: 'session',
  steps: [
    {
      name: 'getSession',
      description: 'Get current session',
      validationSchema: type({
        token: 'string?',
        others: 'object?',
      }),
      inputs: ['token', 'others'],
      run: async (input, pluginProperties) => {
        const { container } = pluginProperties!;
        const { token, others } = input;
        if (!token) {
          return {
            success: false,
            message: 'Token is required',
            status: 'unf',
            others,
          };
        }
        const engine = container.cradle.reAuthEngine;
        const session = await engine.checkSession(token!);
        if (!session.valid) {
          return {
            success: false,
            message: 'Invalid token',
            status: 'unf',
            others,
          };
        }
        return {
          success: true,
          message: 'Session retrieved',
          status: 'su',
          entity: container.cradle.serializeEntity(session.entity!),
          others,
        };
      },
      protocol: {
        http: {
          method: 'POST',
          auth: true,
          unf: 401,
          ip: 400,
          ic: 400,
          su: 200,
          ev: 400,
        },
      },
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
        entity: 'object',
        others: 'object?',
      }),
    },
    {
      name: 'logout',
      description: 'Logout current session',
      validationSchema: type({
        token: 'string?',
        others: 'object?',
      }),
      inputs: ['token', 'others'],
      run: async (input, pluginProperties) => {
        const { container } = pluginProperties!;
        const { token, others } = input;
        if (!token) {
          return {
            success: false,
            message: 'Token is required',
            status: 'unf',
            others,
          };
        }

        const { sessionService } = container.cradle;

        await sessionService.destroySession(token!);
        return {
          success: true,
          message: 'Session destroyed',
          status: 'su',
          others,
        };
      },
      protocol: {
        http: {
          method: 'POST',
          auth: true,
          unf: 401,
          ip: 400,
          ic: 400,
          su: 200,
          ev: 400,
        },
      },
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
        others: 'object?',
      }),
    },
    {
      name: 'logoutAll',
      description: 'Logout all sessions',
      validationSchema: type({
        token: 'string?',
        others: 'object?',
      }),
      inputs: ['token', 'others'],
      run: async (input, pluginProperties) => {
        const { container } = pluginProperties!;
        const { token, others } = input;
        if (!token) {
          return {
            success: false,
            message: 'Token is required',
            status: 'unf',
            others,
          };
        }
        const { sessionService } = container.cradle;
        const session = await sessionService.verifySession(token!);
        if (!session.entity) {
          return {
            success: false,
            message: 'Invalid token',
            status: 'unf',
            others,
          };
        }
        await sessionService.destroyAllSessions(session.entity.id!);
        return {
          success: true,
          message: 'All sessions destroyed',
          status: 'su',
          others,
        };
      },
      protocol: {
        http: {
          method: 'POST',
          auth: true,
          unf: 401,
          ip: 400,
          ic: 400,
          su: 200,
          ev: 400,
        },
      },
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
        others: 'object?',
      }),
    },
  ],
  initialize: async function (container) {
    this.container = container;
  },
  config: {},
};

interface SessionPluginConfig {
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

const sessionPlugin = (
  config: SessionPluginConfig = {},
  overrideStep?: {
    name: string;
    override: Partial<AuthStep<SessionPluginConfig>>;
  }[],
): AuthPlugin<SessionPluginConfig> => {
  return createAuthPlugin(config, plugin, overrideStep);
};

export default sessionPlugin;
