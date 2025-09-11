import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { SessionConfigV2 } from '../types';

export type ListSessionsInput = {
  token: string;
  others?: Record<string, any>;
};

export const listSessionsValidation = type({
  token: 'string',
  others: 'object?',
});

export type ListSessionsOutput = AuthOutput & {
  sessions?: Array<{
    sessionId: string;
    createdAt: string;
    isCurrent: boolean;
  }>;
  totalSessions?: number;
};

export const listSessionsStep: AuthStepV2<
  ListSessionsInput,
  ListSessionsOutput,
  SessionConfigV2
> = {
  name: 'list-sessions',
  description: 'List all active sessions for the authenticated user',
  validationSchema: listSessionsValidation,
  protocol: {
    http: {
      method: 'GET',
      codes: { unf: 401, su: 200, ic: 400 },
    },
  },
  inputs: ['token', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'sessions?': 'object[]',
    'totalSessions?': 'number',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { token, others } = input;

    try {
      // Verify the session to get user info
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

      // Return simplified session data for now
      const sessions = [{
        sessionId: 'current-session',
        createdAt: new Date().toISOString(),
        isCurrent: true,
      }];

      return {
        success: true,
        message: `Found ${sessions.length} active sessions`,
        status: 'su',
        sessions,
        totalSessions: sessions.length,
        others,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to list sessions',
        status: 'ic',
        error: error instanceof Error ? error.message : 'Unknown error',
        others,
      };
    }
  },
};