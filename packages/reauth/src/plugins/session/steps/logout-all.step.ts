import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  Token,
  tokenType,
} from '../../../types';
import type { SessionConfig } from '../types';

export type LogoutAllInput = {
  token: Token;
  others?: Record<string, any>;
};

export const logoutAllValidation = type({
  token: tokenType,
  'others?': 'object',
});

export type LogoutAllOutput = AuthOutput & {
  sessionsDestroyed?: number;
};

export const logoutAllStep: AuthStep<
  SessionConfig,
  'logout-all',
  LogoutAllInput,
  LogoutAllOutput
> = {
  name: 'logout-all',
  description: 'Destroy all sessions for the current user',
  validationSchema: logoutAllValidation,
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
    'sessionsDestroyed?': 'number',
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

      // Count sessions before destruction for reporting
      let sessionsDestroyed = 0;
      if (sessionService.listSessionsForSubject) {
        const subjectType = subject.type || 'subject';
        const subjectId = subject.id;

        const existingSessions = await sessionService.listSessionsForSubject(
          subjectType,
          subjectId,
        );
        sessionsDestroyed = existingSessions.length;
      }

      // Destroy all sessions for this user
      const subjectType = subject.type || 'subject';
      const subjectId = subject.id;

      await sessionService.destroyAllSessions(subjectType, subjectId);

      return {
        success: true,
        message: `All sessions destroyed successfully`,
        status: 'su',
        sessionsDestroyed,
        others,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to destroy all sessions',
        status: 'ic',
        error: error instanceof Error ? error.message : 'Unknown error',
        others,
      };
    }
  },
};
