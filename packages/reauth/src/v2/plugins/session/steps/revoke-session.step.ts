import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { SessionConfigV2 } from '../types';
import { createSessionStorage } from '../utils';

export type RevokeSessionInput = {
  token: string; // Required for authentication
  sessionId: string; // Session to revoke
  others?: Record<string, any>;
};

export const revokeSessionValidation = type({
  token: 'string',
  sessionId: 'string',
  others: 'object?',
});

export type RevokeSessionOutput = AuthOutput & {
  revokedSessionId?: string;
};

export const revokeSessionStep: AuthStepV2<
  RevokeSessionInput,
  RevokeSessionOutput,
  SessionConfigV2
> = {
  name: 'revoke-session',
  description: 'Revoke a specific session for the authenticated user',
  validationSchema: revokeSessionValidation,
  protocol: {
    http: {
      method: 'DELETE',
      codes: { unf: 401, nf: 404, su: 200, ic: 400, denied: 403 },
    },
  },
  inputs: ['token', 'sessionId', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'revokedSessionId?': 'string',
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

      // Check if the session to revoke exists
      const targetSession = await storage.getSession(sessionId);
      if (!targetSession) {
        return {
          success: false,
          message: 'Session not found',
          status: 'nf',
          error: 'The specified session does not exist',
          others,
        };
      }

      // Verify the user owns the session they want to revoke
      if (targetSession.subjectType !== (subject.type || 'subject') || 
          targetSession.subjectId !== subject.id) {
        return {
          success: false,
          message: 'Permission denied',
          status: 'denied',
          error: 'You can only revoke your own sessions',
          others,
        };
      }

      // Check if user is trying to revoke their current session
      const currentSession = await orm.findFirst('sessions', {
        where: (b: any) => b('token', '=', token),
      });

      if (currentSession?.id === sessionId) {
        return {
          success: false,
          message: 'Cannot revoke current session',
          status: 'denied',
          error: 'Use logout or revoke-all-sessions to end your current session',
          others,
        };
      }

      // Revoke the session
      await storage.deleteSession(sessionId);

      return {
        success: true,
        message: 'Session revoked successfully',
        status: 'su',
        revokedSessionId: sessionId,
        others,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to revoke session',
        status: 'ic',
        error: error instanceof Error ? error.message : 'Unknown error',
        others,
      };
    }
  },
};