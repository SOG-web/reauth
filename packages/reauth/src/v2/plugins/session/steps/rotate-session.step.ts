import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { SessionConfigV2 } from '../types';
import { createSessionStorage, rotateSessionToken } from '../utils';

export type RotateSessionInput = {
  token: string; // Required for authentication
  sessionId?: string; // Optional specific session ID (defaults to current session)
  others?: Record<string, any>;
};

export const rotateSessionValidation = type({
  token: 'string',
  sessionId: 'string?',
  others: 'object?',
});

export type RotateSessionOutput = AuthOutput & {
  newToken?: string;
  sessionId?: string;
  rotatedAt?: string;
};

export const rotateSessionStep: AuthStepV2<
  RotateSessionInput,
  RotateSessionOutput,
  SessionConfigV2
> = {
  name: 'rotate-session',
  description: 'Generate a new session token for security (session rotation)',
  validationSchema: rotateSessionValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { unf: 401, nf: 404, su: 200, ic: 400, denied: 403 },
    },
  },
  inputs: ['token', 'sessionId', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'token?': 'string', // New token
    'newToken?': 'string', // Alias for clarity
    'sessionId?': 'string',
    'rotatedAt?': 'string',
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

      // Get session info to verify ownership
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

      // Verify the user owns the session they want to rotate
      if (session.subjectType !== (subject.type || 'subject') || 
          session.subjectId !== subject.id) {
        return {
          success: false,
          message: 'Permission denied',
          status: 'denied',
          error: 'You can only rotate your own sessions',
          others,
        };
      }

      // Rotate the session token
      const rotationResult = await rotateSessionToken(storage, targetSessionId);
      
      if (!rotationResult.success) {
        return {
          success: false,
          message: 'Failed to rotate session',
          status: 'ic',
          error: rotationResult.error || 'Unknown error during rotation',
          others,
        };
      }

      // Update enhanced session metadata for rotation tracking
      const now = new Date();
      try {
        await orm.updateOne('enhanced_sessions', {
          where: (b: any) => b('session_id', '=', targetSessionId),
          set: {
            rotation_count: (session as any).rotation_count ? (session as any).rotation_count + 1 : 1,
            last_rotated_at: now,
            updated_at: now,
          },
        });
      } catch (enhancedError) {
        // Enhanced session tracking is optional - don't fail if it doesn't exist
        console.warn('Failed to update enhanced session metadata:', enhancedError);
      }

      const result: RotateSessionOutput = {
        success: true,
        message: 'Session token rotated successfully',
        status: 'su',
        token: rotationResult.newToken, // For client to use as new token
        newToken: rotationResult.newToken, // Explicit field for clarity
        sessionId: targetSessionId,
        rotatedAt: now.toISOString(),
        others,
      };

      // If rotating current session, include warning in response
      if (targetSessionId === currentSessionId) {
        result.message = 'Current session token rotated - use new token for future requests';
      }

      return result;
    } catch (error) {
      return {
        success: false,
        message: 'Failed to rotate session',
        status: 'ic',
        error: error instanceof Error ? error.message : 'Unknown error',
        others,
      };
    }
  },
};