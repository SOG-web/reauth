import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  Token,
  tokenType,
} from '../../../types';
import type { SessionConfig } from '../types';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export type ListSessionsInput = {
  token: Token;
  others?: Record<string, any>;
};

export const listSessionsValidation = type({
  token: tokenType,
  'others?': 'object',
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
  SessionConfig,
  'list-sessions',
  ListSessionsInput,
  ListSessionsOutput
> = {
  name: 'list-sessions',
  description: 'List all active sessions for the authenticated user',
  validationSchema: listSessionsValidation,
  protocol: {
    http: {
      method: 'GET',
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
    'sessions?': type({
      sessionId: 'string',
      token: tokenType,
      createdAt: 'string',
      expiresAt: 'string',
      isCurrent: 'boolean',
      'deviceInfo?': 'object',
      'metadata?': 'object',
    }).array(),
    'totalSessions?': 'number',
    'others?': 'object',
    'token?': tokenType,
  }),
  async run(input, ctx) {
    const { token, others } = input;
    const ses = await ctx.engine.checkSession(token);

    if (!ses.subject) {
      return {
        success: false,
        message: 'Authentication required',
        status: 'unf',
        error: 'Invalid or expired session',
        others,
      };
    }

    try {
      // Get the enhanced session service via DI container (type-safe)
      const sessionService = ctx.engine.getSessionService();

      if (!sessionService) {
        throw new Error('SessionService not registered in container');
      }

      // Use the enhanced session listing if available
      let sessions: any[] = [];
      let totalSessions = 0;

      if (sessionService.listSessionsForSubject) {
        // Extract subject type and ID - this assumes a standard format
        const subjectType = ses.subject.type || 'subject';
        const subjectId = ses.subject.id;

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

      return attachNewTokenIfDifferent(
        {
          success: true,
          message: `Found ${totalSessions} active sessions`,
          status: 'su',
          sessions,
          totalSessions,
          others,
        },
        token,
        ses.token,
      );
    } catch (error) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Failed to list sessions',
          status: 'ic',
          error: error instanceof Error ? error.message : 'Unknown error',
          others,
        },
        token,
        ses.token,
      );
    }
  },
};
