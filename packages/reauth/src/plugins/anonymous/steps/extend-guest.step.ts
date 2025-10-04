import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  tokenType,
  Token,
} from '../../../types';
import type { AnonymousConfig } from '../types';
import { calculateExpiresAt, canExtendSession } from '../utils';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export type ExtendGuestInput = {
  token: Token;
  others?: Record<string, any>;
};

export const extendGuestValidation = type({
  token: tokenType,
  'others?': 'object | undefined',
});

export const extendGuestStep: AuthStep<
  AnonymousConfig,
  ExtendGuestInput,
  AuthOutput
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
    'token?': tokenType,
    'subject?': type({
      id: 'string',
      type: 'string',
      fingerprint: 'string',
      temporary: 'boolean',
      expiresAt: 'string',
      metadata: 'object?',
    }),
    'newExpiresAt?': 'string',
    'extensionsRemaining?': 'number',
    'others?': 'object | undefined',
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
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Session is not a guest session',
          status: 'ic',
          others,
        },
        token,
        sessionCheck.token,
      );
    }

    // Check if session can be extended
    const canExtend = await canExtendSession(subjectId, orm, ctx.config);
    if (!canExtend) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Session cannot be extended (maximum extensions reached)',
          status: 'tl',
          others,
        },
        token,
        sessionCheck.token,
      );
    }

    // Check if session has not already expired
    if (new Date() > new Date(anonymousSession.expires_at as string)) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Session has already expired',
          status: 'ip',
          others,
        },
        token,
        sessionCheck.token,
      );
    }

    try {
      // Calculate new expiration time
      const newExpiresAt = calculateExpiresAt(ctx.config);
      const currentExtensionCount =
        typeof anonymousSession.extension_count === 'number'
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
      const newToken = await ctx.engine.createSessionFor(
        'guest',
        subjectId,
        ttl,
      );

      const maxExtensions = ctx.config?.maxSessionExtensions ?? 3;
      const extensionsRemaining = maxExtensions - newExtensionCount;

      const updatedSubject = {
        ...sessionCheck.subject,
        expiresAt: newExpiresAt.toISOString(),
        extensionsUsed: newExtensionCount,
        extensionsRemaining,
      };

      const base = {
        success: true,
        message: 'Guest session extended successfully',
        status: 'su',
        subject: updatedSubject,
        newExpiresAt: newExpiresAt.toISOString(),
        extensionsRemaining,
        others,
      } as const;

      return attachNewTokenIfDifferent(base, token, newToken);
    } catch (error) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Failed to extend guest session',
          status: 'ic',
          others,
        },
        token,
        sessionCheck.token,
      );
    }
  },
};
