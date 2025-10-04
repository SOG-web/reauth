import { type } from 'arktype';
import type {
  AuthStepV2,
  AuthOutput,
  SessionServiceV2,
} from '../../../types.v2';
import type { SessionConfigV2 } from '../types';

export type LogoutAllInput = {
  token: string;
  others?: Record<string, any>;
};

export const logoutAllValidation = type({
  token: 'string',
  'others?': 'object | undefined',
});

export type LogoutAllOutput = AuthOutput & {
  sessionsDestroyed?: number;
};

export const logoutAllStep: AuthStepV2<
  LogoutAllInput,
  LogoutAllOutput,
  SessionConfigV2
> = {
  name: 'logout-all',
  description: 'Destroy all sessions for the current user',
  validationSchema: logoutAllValidation,
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
    'sessionsDestroyed?': 'number',
    'others?': 'object | undefined',
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

      // Get the session service via DI container (type-safe)
      const sessionService =
        ctx.container.resolve<SessionServiceV2>('sessionServiceV2');

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
