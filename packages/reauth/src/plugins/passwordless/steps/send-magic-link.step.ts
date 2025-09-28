import { type } from 'arktype';
import type { AuthStep, AuthOutput } from '../../../types';
import type { PasswordlessConfig } from '../types';
import {
  generateMagicLinkToken,
  hashMagicLinkToken,
  getMagicLinkExpiration,
  cleanupExpiredMagicLinks,
} from '../utils';

export type SendMagicLinkInput = {
  email: string;
  others?: Record<string, any>;
};

export const sendMagicLinkValidation = type({
  email: 'string.email',
  others: 'object?',
});

export const sendMagicLinkStep: AuthStep<
  PasswordlessConfig,
  SendMagicLinkInput,
  AuthOutput
> = {
  name: 'send-magic-link',
  description: 'Generate and send a magic link for passwordless authentication',
  validationSchema: sendMagicLinkValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ic: 400, nf: 404 },
    },
  },
  inputs: ['email', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { email, others } = input;
    const orm = await ctx.engine.getOrm();

    // Validate config requires magic links
    if (
      !ctx.config?.magicLinks ||
      typeof ctx.config.sendMagicLink !== 'function'
    ) {
      return {
        success: false,
        message: 'Magic link authentication is not configured',
        status: 'ic',
        error:
          'Magic link authentication is not enabled or sendMagicLink function is missing',
      };
    }

    try {
      // Clean up expired magic links (best effort)
      await cleanupExpiredMagicLinks(orm);

      let useExtran = false;

      if (ctx.config.getEmail && !ctx.config.useEmailPlugin) {
        const em = await ctx.config.getEmail(input);

        if (!em || em === '') {
          return {
            success: false,
            message:
              'If an account exists for this email, a magic link has been sent.',
            status: 'nf',
            error:
              'If an account exists for this email, a magic link has been sent.',
          };
        }

        useExtran = true;
      }

      // Find existing subject by email
      let identity = {
        subject_id: '',
      } as any;

      if (!useExtran) {
        identity = await orm.findFirst('identities', {
          where: (b: any) =>
            b.and(b('identifier', '=', email), b('provider', '=', 'email')),
        });
      } else {
        const ns = await orm.create('subject', {});
        identity = {
          subject_id: ns.id,
        };
      }

      if (!identity) {
        return {
          success: false,
          message:
            'If an account exists for this email, a magic link has been sent.',
          status: 'nf',
        };
      }

      // Generate magic link token
      const token = generateMagicLinkToken();
      const tokenHash = hashMagicLinkToken(token);
      const expiresAt = getMagicLinkExpiration(ctx.config.magicLinkTtlMinutes);

      // Store magic link in database
      await orm.create('magic_links', {
        subject_id: identity.subject_id,
        token_hash: tokenHash,
        email,
        expires_at: expiresAt,
        used_at: null,
        metadata: others || null,
      });

      // Get subject for sendMagicLink function
      const subject = await orm.findFirst('subjects', {
        where: (b: any) => b('id', '=', identity.subject_id),
      });

      // Send magic link via configured function
      await ctx.config.sendMagicLink(email, token, subject);

      return {
        success: true,
        message: 'Magic link sent successfully',
        status: 'su',
        others: {
          email,
          expires_at: expiresAt.toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to send magic link',
        status: 'ic',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};
