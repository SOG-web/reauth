import { type } from 'arktype';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';
import {
  type AuthStep,
  type AuthOutput,
  tokenType,
  Token,
} from '../../../types';
import type { PasswordlessConfig } from '../types';
import {
  hashMagicLinkToken,
  isMagicLinkExpired,
  cleanupExpiredMagicLinks,
} from '../utils';

export type VerifyMagicLinkInput = {
  others?: Record<string, any>;
  magic_token: string;
};

export const verifyMagicLinkValidation = type({
  magic_token: 'string',
  others: 'object?',
});

export const verifyMagicLinkStep: AuthStep<
  PasswordlessConfig,
  VerifyMagicLinkInput,
  AuthOutput
> = {
  name: 'verify-magic-link',
  description: 'Verify magic link token and authenticate user',
  validationSchema: verifyMagicLinkValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ic: 400, nf: 404, ex: 410 },
    },
  },
  inputs: ['magic_token', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'token?': tokenType,
    'subject?': type({
      id: 'string',
      'email?': 'string',
      'name?': 'string',
    }),
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { magic_token, others } = input;
    const orm = await ctx.engine.getOrm();

    // Validate config requires magic links
    if (!ctx.config?.magicLinks) {
      return {
        success: false,
        message: 'Magic link authentication is not configured',
        status: 'ic',
        error: 'Magic link authentication is not enabled',
      };
    }

    try {
      // Clean up expired magic links (best effort)
      await cleanupExpiredMagicLinks(orm);

      // Hash the provided token
      const tokenHash = hashMagicLinkToken(magic_token);

      // Find magic link by token hash
      const magicLink = await orm.findFirst('magic_links', {
        where: (b: any) => b('token_hash', '=', tokenHash),
      });

      if (!magicLink) {
        return {
          success: false,
          message: 'Invalid or expired magic link',
          status: 'nf',
        };
      }

      // Check if link has been used
      if (magicLink.used_at) {
        return {
          success: false,
          message: 'Magic link has already been used',
          status: 'ex',
        };
      }

      // Check if link has expired
      if (isMagicLinkExpired(magicLink.expires_at as Date)) {
        return {
          success: false,
          message: 'Magic link has expired',
          status: 'ex',
        };
      }

      // Mark magic link as used
      await (orm as any).updateMany('magic_links', {
        where: (b: any) => b('id', '=', magicLink.id),
        set: { used_at: new Date() },
      });

      // Get subject
      const subject = await orm.findFirst('subjects', {
        where: (b: any) => b('id', '=', magicLink.subject_id),
      });

      if (!subject) {
        return {
          success: false,
          message: 'Associated account not found',
          status: 'nf',
        };
      }

      // Create session
      const sessionToken = await ctx.engine.createSessionFor(
        'subject',
        subject.id as string,
        ctx.config.sessionTtlSeconds || 3600,
      );

      const baseResult = {
        success: true,
        message: 'Authentication successful',
        status: 'su',
        subject,
        others: {
          email: magicLink.email,
          authentication_method: 'magic_link',
          ...others,
        },
      };

      return attachNewTokenIfDifferent(baseResult, undefined, sessionToken);
    } catch (error) {
      return {
        success: false,
        message: 'Failed to verify magic link',
        status: 'ic',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};
