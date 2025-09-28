import { type } from 'arktype';
import type { AuthStepV2, AuthOutput, SessionServiceV2 } from '../../../types.v2';
import type { SessionConfigV2 } from '../types';

export type LogoutInput = {
  token: string;
  others?: Record<string, any>;
};

export const logoutValidation = type({
  token: 'string',
  others: 'object?',
});

export type LogoutOutput = AuthOutput & {
  sessionDestroyed?: boolean;
};

export const logoutStep: AuthStepV2<
  LogoutInput,
  LogoutOutput,
  SessionConfigV2
> = {
  name: 'logout',
  description: 'Destroy the current session (logout)',
  validationSchema: logoutValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { unf: 401, su: 200, ic: 400 },
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
      const sessionService = ctx.container.resolve<SessionServiceV2>('sessionServiceV2');
      
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