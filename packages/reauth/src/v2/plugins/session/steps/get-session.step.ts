import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { SessionConfigV2 } from '../types';

export type GetSessionInput = {
  token: string;
  others?: Record<string, any>;
};

export const getSessionValidation = type({
  token: 'string',
  others: 'object?',
});

export type GetSessionOutput = AuthOutput & {
  session?: {
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
};

export const getSessionStep: AuthStepV2<
  GetSessionInput,
  GetSessionOutput,
  SessionConfigV2
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
    'session?': 'object',
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

      // Get the session service
      const sessionService = (ctx.engine as any).getSessionService();
      
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
        
        const sessions = await sessionService.listSessionsForSubject(subjectType, subjectId);
        
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