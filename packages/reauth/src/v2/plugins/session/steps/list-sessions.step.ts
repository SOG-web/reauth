import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { SessionConfigV2 } from '../types';
import { createSessionStorage } from '../utils';

export type ListSessionsInput = {
  token: string; // Required for authentication
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
    updatedAt: string;
    expiresAt?: string;
    device?: {
      fingerprint?: string;
      userAgent?: string;
      ipAddress?: string;
      location?: string;
      isTrusted: boolean;
      deviceName?: string;
    };
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
    const orm = await ctx.engine.getOrm();
    const storage = createSessionStorage(ctx.config || {}, orm);

    try {
      // Verify the session to get user info
      const sessionService = ctx.engine.getSessionService();
      const { subject } = await sessionService.verifySession(token);
      
      if (!subject) {
        return {
          success: false,
          message: 'Authentication required',
          status: 'unf',
          error: 'Invalid or expired session',
          others,
        };
      }

      // Get current session ID from token lookup
      const currentSession = await orm.findFirst('sessions', {
        where: (b: any) => b('token', '=', token),
      });
      const currentSessionId = currentSession?.id;

      // List all user sessions
      const sessions = await storage.listUserSessions(subject.type || 'subject', subject.id);
      const totalSessions = sessions.length;

      // Get device info for each session
      const sessionList = await Promise.all(
        sessions.map(async (session) => {
          const device = await storage.getDevice(session.sessionId);
          
          return {
            sessionId: session.sessionId,
            createdAt: session.createdAt.toISOString(),
            updatedAt: session.updatedAt.toISOString(),
            expiresAt: session.expiresAt?.toISOString(),
            device: device ? {
              fingerprint: device.fingerprint,
              userAgent: device.userAgent,
              ipAddress: device.ipAddress,
              location: device.location,
              isTrusted: device.isTrusted,
              deviceName: device.deviceName,
            } : undefined,
            isCurrent: session.sessionId === currentSessionId,
          };
        })
      );

      return {
        success: true,
        message: `Found ${totalSessions} active sessions`,
        status: 'su',
        sessions: sessionList,
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