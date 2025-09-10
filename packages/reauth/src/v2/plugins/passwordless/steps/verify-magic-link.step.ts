import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { PasswordlessConfigV2 } from '../types';
import { 
  hashMagicLinkToken, 
  isMagicLinkExpired,
  cleanupExpiredMagicLinks 
} from '../utils';

export type VerifyMagicLinkInput = {
  token: string;
  others?: Record<string, any>;
};

export const verifyMagicLinkValidation = type({
  token: 'string',
  others: 'object?',
});

export const verifyMagicLinkStep: AuthStepV2<
  VerifyMagicLinkInput,
  AuthOutput,
  PasswordlessConfigV2
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
  inputs: ['token', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'token?': 'string',
    'subject?': 'object',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { token, others } = input;
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
      const tokenHash = hashMagicLinkToken(token);

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

      return {
        success: true,
        message: 'Authentication successful',
        status: 'su',
        token: sessionToken,
        subject,
        others: {
          email: magicLink.email,
          authentication_method: 'magic_link',
          ...others,
        },
      };
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