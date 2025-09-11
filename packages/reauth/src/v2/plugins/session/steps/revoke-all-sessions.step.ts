import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { SessionConfigV2 } from '../types';
import { createSessionStorage } from '../utils';

export type RevokeAllSessionsInput = {
  token: string; // Required for authentication
  includeCurrent?: boolean; // Whether to include current session (default: false)
  others?: Record<string, any>;
};

export const revokeAllSessionsValidation = type({
  token: 'string',
  includeCurrent: 'boolean?',
  others: 'object?',
});

export type RevokeAllSessionsOutput = AuthOutput & {
  revokedCount?: number;
  totalSessions?: number;
};

export const revokeAllSessionsStep: AuthStepV2<
  RevokeAllSessionsInput,
  RevokeAllSessionsOutput,
  SessionConfigV2
> = {
  name: 'revoke-all-sessions',
  description: 'Revoke all sessions for the authenticated user (except current by default)',
  validationSchema: revokeAllSessionsValidation,
  protocol: {
    http: {
      method: 'DELETE',
      codes: { unf: 401, su: 200, ic: 400 },
    },
  },
  inputs: ['token', 'includeCurrent', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'revokedCount?': 'number',
    'totalSessions?': 'number',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { token, includeCurrent = false, others } = input;
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

      // Get current session ID if we need to preserve it
      let currentSessionId: string | undefined;
      if (!includeCurrent) {
        const currentSession = await orm.findFirst('sessions', {
          where: (b: any) => b('token', '=', token),
        });
        currentSessionId = currentSession?.id;
      }

      // Count total sessions before deletion
      const totalSessions = await storage.countUserSessions(
        subject.type || 'subject', 
        subject.id
      );

      // Revoke all sessions (except current if specified)
      const revokedCount = await storage.deleteAllUserSessions(
        subject.type || 'subject',
        subject.id,
        currentSessionId
      );

      if (includeCurrent && currentSessionId) {
        // If including current session, we need to handle token invalidation
        // The response should indicate that the current session is also revoked
        return {
          success: true,
          message: `Revoked all ${revokedCount} sessions including current session`,
          status: 'su',
          revokedCount,
          totalSessions,
          token: null, // Invalidate current token
          others,
        };
      }

      return {
        success: true,
        message: `Revoked ${revokedCount} sessions (current session preserved)`,
        status: 'su',
        revokedCount,
        totalSessions,
        others,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to revoke sessions',
        status: 'ic',
        error: error instanceof Error ? error.message : 'Unknown error',
        others,
      };
    }
  },
};