import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { SessionConfigV2 } from '../types';
import { createSessionStorage } from '../utils';

export type GetSessionInfoInput = {
  token: string; // Required for authentication
  sessionId?: string; // Optional specific session ID (defaults to current session)
  others?: Record<string, any>;
};

export const getSessionInfoValidation = type({
  token: 'string',
  sessionId: 'string?',
  others: 'object?',
});

export type GetSessionInfoOutput = AuthOutput & {
  session?: {
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
      firstSeenAt: string;
      lastSeenAt: string;
    };
    metadata?: Record<string, any>;
    isCurrent: boolean;
  };
};

export const getSessionInfoStep: AuthStepV2<
  GetSessionInfoInput,
  GetSessionInfoOutput,
  SessionConfigV2
> = {
  name: 'get-session-info',
  description: 'Get detailed information about a session',
  validationSchema: getSessionInfoValidation,
  protocol: {
    http: {
      method: 'GET',
      codes: { unf: 401, nf: 404, su: 200, ic: 400, denied: 403 },
    },
  },
  inputs: ['token', 'sessionId', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'session?': 'object',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { token, sessionId, others } = input;
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

      // Get current session ID from token
      const currentSession = await orm.findFirst('sessions', {
        where: (b: any) => b('token', '=', token),
      });
      const currentSessionId = currentSession?.id;

      // Determine target session ID (current session if not specified)
      const targetSessionId = sessionId || currentSessionId;
      
      if (!targetSessionId) {
        return {
          success: false,
          message: 'Session ID required',
          status: 'ic',
          error: 'Could not determine session ID',
          others,
        };
      }

      // Get session info
      const session = await storage.getSession(targetSessionId);
      if (!session) {
        return {
          success: false,
          message: 'Session not found',
          status: 'nf',
          error: 'The specified session does not exist',
          others,
        };
      }

      // Verify the user owns the session they want to inspect
      if (session.subjectType !== (subject.type || 'subject') || 
          session.subjectId !== subject.id) {
        return {
          success: false,
          message: 'Permission denied',
          status: 'denied',
          error: 'You can only inspect your own sessions',
          others,
        };
      }

      // Get device information
      const device = await storage.getDevice(targetSessionId);

      // Get metadata
      const metadataList = await storage.getMetadata(targetSessionId);
      const metadata: Record<string, any> = {};
      metadataList.forEach(m => {
        metadata[m.key] = m.value;
      });

      const sessionInfo = {
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
          firstSeenAt: device.firstSeenAt.toISOString(),
          lastSeenAt: device.lastSeenAt.toISOString(),
        } : undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        isCurrent: targetSessionId === currentSessionId,
      };

      return {
        success: true,
        message: 'Session information retrieved successfully',
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