import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  Token,
  tokenType,
} from '../../../types';
import type { SessionConfig } from '../types';

export type LogoutInput = {
  token: Token;
  others?: Record<string, any>;
};

export const logoutValidation = type({
  token: tokenType,
  'others?': 'object',
});

export type LogoutOutput = AuthOutput & {
  sessionDestroyed?: boolean;
};

export const logoutStep: AuthStep<
  SessionConfig,
  'logout',
  LogoutInput,
  LogoutOutput
> = {
  name: 'logout',
  description: 'Destroy the current session (logout)',
  validationSchema: logoutValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { unf: 401, su: 200, ic: 400 },
      auth: true,
    },
  },
  inputs: ['token', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'sessionDestroyed?': 'boolean',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { token, others } = input;

    try {
      // Verify the session exists and is valid
      const { subject } = await ctx.engine.checkSession(token);

      if (!subject) {
        return {
          success: false,
          message: 'Authentication required',
          status: 'unf',
          error: 'Invalid or expired session',
          others,
        };
      }

      // Get the session service and destroy the session via DI container (type-safe)
      const sessionService = ctx.engine.getSessionService();

      if (!sessionService) {
        return {
          success: false,
          message: 'Session service not available',
          status: 'ic',
          error: 'Session management not configured',
          others,
        };
      }

      await sessionService.destroySession(token);

      return {
        success: true,
        message: 'Session destroyed successfully',
        status: 'su',
        sessionDestroyed: true,
        others,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to destroy session',
        status: 'ic',
        error: error instanceof Error ? error.message : 'Unknown error',
        others,
      };
    }
  },
};
