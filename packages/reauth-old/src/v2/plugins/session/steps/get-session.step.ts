import { type } from 'arktype';
import type { AuthStep, AuthOutput, SessionService } from '../../../types.';
import type { SessionConfig } from '../types';

export type GetSessionInput = {
  token: string;
  others?: Record<string, any>;
};

export const getSessionValidation = type({
  token: 'string',
  others: 'object?',
});

type Session = {
  sessionId: string;
  token: string;
  subject: any;
  createdAt: string;
  expiresAt?: string;
  deviceInfo?: {
    fingerprint?: string;
    userAgent?: string;
    ipAddress?: string;
    isTrusted: boolean;
    deviceName?: string;
  };
  metadata?: Record<string, any>;
};

export type GetSessionOutput = AuthOutput & {
  session?: Session;
};

export const getSessionStep: AuthStep<
  GetSessionInput,
  GetSessionOutput,
  SessionConfig
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
  inputs: ['token', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'session?': type({
      sessionId: 'string',
      token: 'string',
      subject: 'object',
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
    const { token, others } = input;

    try {
      // Verify the session and get subject
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
        ctx.container.resolve<SessionService>('sessionService');

      if (!sessionService) {
        return {
          success: false,
          message: 'Session service not available',
          status: 'ic',
          error: 'Session management not configured',
          others,
        };
      }

      // Try to get enhanced session information if available
      let sessionInfo: any = {
        sessionId: 'current-session',
        token: '*current*',
        subject,
        createdAt: new Date().toISOString(),
      };

      if (sessionService.listSessionsForSubject) {
        const subjectType = subject.type || 'subject';
        const subjectId = subject.id;

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
            subject,
            createdAt: currentSession.createdAt,
            expiresAt: currentSession.expiresAt,
            deviceInfo: currentSession.deviceInfo,
            metadata: currentSession.metadata,
          };
        }
      }

      return {
        success: true,
        message: 'Current session information retrieved',
        status: 'su',
        session: sessionInfo,
        others,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get session information',
        status: 'ic',
        error: error instanceof Error ? error.message : 'Unknown error',
        others,
      };
    }
  },
};
