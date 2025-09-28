import { type } from 'arktype';
import type { AuthStep, AuthOutput, SessionService } from '../../../types.';
import type { SessionConfig } from '../types';

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

export const listSessionsStep: AuthStep<
  ListSessionsInput,
  ListSessionsOutput,
  SessionConfig
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
    'sessions?': [
      type({
        sessionId: 'string',
        token: 'string',
        createdAt: 'string',
        expiresAt: 'string',
        isCurrent: 'boolean',
        'deviceInfo?': 'object',
        'metadata?': 'object',
      }),
    ],
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

      // Get the enhanced session service via DI container (type-safe)
      const sessionService =
        ctx.container.resolve<SessionService>('sessionService');

      if (!sessionService) {
        throw new Error('SessionService not registered in container');
      }

      // Use the enhanced session listing if available
      let sessions: any[] = [];
      let totalSessions = 0;

      if (sessionService.listSessionsForSubject) {
        // Extract subject type and ID - this assumes a standard format
        const subjectType = subject.type || 'subject';
        const subjectId = subject.id;

        const enhancedSessions = await sessionService.listSessionsForSubject(
          subjectType,
          subjectId,
        );

        sessions = enhancedSessions.map((session: any) => ({
          sessionId: session.sessionId,
          token:
            session.token === token
              ? '*current*'
              : session.token.substring(0, 8) + '...',
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          isCurrent: session.token === token,
          deviceInfo: session.deviceInfo,
          metadata: session.metadata,
        }));
        totalSessions = sessions.length;
      } else {
        // Fallback to simple session data
        sessions = [
          {
            sessionId: 'current-session',
            token: '*current*',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour default
            isCurrent: true,
            deviceInfo: undefined,
            metadata: undefined,
          },
        ];
        totalSessions = 1;
      }

      return {
        success: true,
        message: `Found ${totalSessions} active sessions`,
        status: 'su',
        sessions,
        totalSessions,
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
