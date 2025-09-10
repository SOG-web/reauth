import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { AnonymousConfigV2 } from '../types';
import { calculateExpiresAt, canExtendSession } from '../utils';

export type ExtendGuestInput = {
  token: string;
  others?: Record<string, any>;
};

export const extendGuestValidation = type({
  token: 'string',
  others: 'object?',
});

export const extendGuestStep: AuthStepV2<
  ExtendGuestInput,
  AuthOutput,
  AnonymousConfigV2
> = {
  name: 'extend-guest',
  description: 'Extend the duration of an anonymous guest session',
  validationSchema: extendGuestValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ip: 401, ic: 400, tl: 429 },
      auth: true,
    },
  },
  inputs: ['token', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'token?': 'string',
    'subject?': 'object',
    'newExpiresAt?': 'string',
    'extensionsRemaining?': 'number',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { token, others } = input;
    const orm = await ctx.engine.getOrm();

    // Verify the current session
    const sessionCheck = await ctx.engine.checkSession(token);
    if (!sessionCheck.valid || !sessionCheck.subject) {
      return {
        success: false,
        message: 'Invalid or expired session',
        status: 'ip',
        others,
      };
    }

    const subjectId = sessionCheck.subject.id;

    // Check if this is a guest session
    const anonymousSession = await orm.findFirst('anonymous_sessions', {
      where: (b: any) => b('subject_id', '=', subjectId),
    });

    if (!anonymousSession) {
      return {
        success: false,
        message: 'Session is not a guest session',
        status: 'ic',
        others,
      };
    }

    // Check if session can be extended
    const canExtend = await canExtendSession(subjectId, orm, ctx.config);
    if (!canExtend) {
      return {
        success: false,
        message: 'Session cannot be extended (maximum extensions reached)',
        status: 'tl',
        others,
      };
    }

    // Check if session has not already expired
    if (new Date() > new Date(anonymousSession.expires_at as string)) {
      return {
        success: false,
        message: 'Session has already expired',
        status: 'ip',
        others,
      };
    }

    try {
      // Calculate new expiration time
      const newExpiresAt = calculateExpiresAt(ctx.config);
      const currentExtensionCount = typeof anonymousSession.extension_count === 'number' 
        ? anonymousSession.extension_count 
        : 0;
      const newExtensionCount = currentExtensionCount + 1;

      // Update the anonymous session
      await (orm as any).updateMany('anonymous_sessions', {
        where: (b: any) => b('subject_id', '=', subjectId),
        set: {
          expires_at: newExpiresAt,
          extension_count: newExtensionCount,
          updated_at: new Date(),
        },
      });

      // Create a new session token with extended TTL
      const ttl = ctx.config?.sessionTtlSeconds ?? 1800;
      const newToken = await ctx.engine.createSessionFor('guest', subjectId, ttl);

      const maxExtensions = ctx.config?.maxSessionExtensions ?? 3;
      const extensionsRemaining = maxExtensions - newExtensionCount;

      const updatedSubject = {
        ...sessionCheck.subject,
        expiresAt: newExpiresAt.toISOString(),
        extensionsUsed: newExtensionCount,
        extensionsRemaining,
      };

      return {
        success: true,
        message: 'Guest session extended successfully',
        status: 'su',
        token: newToken,
        subject: updatedSubject,
        newExpiresAt: newExpiresAt.toISOString(),
        extensionsRemaining,
        others,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to extend guest session',
        status: 'ic',
        others,
      };
    }
  },
};