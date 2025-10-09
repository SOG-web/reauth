import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  type Token,
  tokenType,
} from '../../../types';
import type { SessionConfig } from '../types';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export type GetSessionInput = {
  token: Token;
  deviceInfo?: Record<string, any>;
  others?: Record<string, any>;
};

export const getSessionValidation = type({
  token: tokenType,
  'deviceInfo?': 'object',
  'others?': 'object',
});

type Session = {
  sessionId: string;
  token: Token;
  subject: any;
  createdAt: string;
  expiresAt?: string;
  deviceInfo?: Record<string, any>;
  metadata?: Record<string, any>;
};

export type GetSessionOutput = AuthOutput & {
  session?: Session;
};

export const getSessionStep: AuthStep<
  SessionConfig,
  'get-session',
  GetSessionInput,
  GetSessionOutput
> = {
  name: 'get-session',
  description: 'Get information about the current session',
  validationSchema: getSessionValidation,
  protocol: {
    http: {
      method: 'GET',
      codes: { unf: 401, su: 200, ic: 400 },
    },
  },
  inputs: ['token', 'deviceInfo', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'session?': type({
      sessionId: 'string',
      token: tokenType,
      subject: 'object?',
      createdAt: 'string',
      expiresAt: 'string?',
      'deviceInfo?': type({
        fingerprint: 'string?',
        userAgent: 'string?',
        ipAddress: 'string?',
        isTrusted: 'boolean',
        deviceName: 'string?',
      }),
      metadata: 'object?',
    }),
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { token, deviceInfo, others } = input;

    try {
      // Pass deviceInfo through to service
      const result = await ctx.engine
        .getSessionService()
        .verifySession(token, deviceInfo);

      if (!result.subject) {
        return {
          success: false,
          message: 'Authentication required',
          status: 'unf',
          error: 'Invalid or expired session',
          others,
        };
      }

      const ses = result;

      const sessionService = ctx.engine.getSessionService();

      if (!sessionService) {
        return attachNewTokenIfDifferent(
          {
            success: false,
            message: 'Session service not available',
            status: 'ic',
            error: 'Session management not configured',
            others,
          },
          token,
          ses.token,
        );
      }

      // Try to get enhanced session information if available
      let sessionInfo: any = {
        sessionId: 'current-session',
        token: '*current*',
        subject: ses.subject,
        createdAt: new Date().toISOString(),
      };

      if (sessionService.listSessionsForSubject) {
        const subjectType = ses.subject.type || 'subject';
        const subjectId = ses.subject.id;

        const sessions = await sessionService.listSessionsForSubject(
          subjectType,
          subjectId,
        );

        // Find the current session by token
        const currentSession = sessions.find((s: any) => s.token === token);

        if (currentSession) {
          sessionInfo = {
            sessionId: currentSession.sessionId,
            token: '*current*', // Don't expose full token for security
            subject: ses.subject,
            createdAt: currentSession.createdAt,
            expiresAt: currentSession.expiresAt,
            deviceInfo: currentSession.deviceInfo,
            metadata: currentSession.metadata,
          };
        }
      }

      return attachNewTokenIfDifferent(
        {
          success: true,
          message: 'Current session information retrieved',
          status: 'su',
          session: sessionInfo,
          others,
        },
        token,
        ses.token,
      );
    } catch (error) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Failed to get session information',
          status: 'ic',
          error: error instanceof Error ? error.message : 'Unknown error',
          others,
        },
        token,
        token, // Use original token since verification failed
      );
    }
  },
};
