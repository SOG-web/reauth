import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  type Token,
  tokenType,
} from '../../../types';
import type { PasswordlessConfig } from '../types';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export type ListCredentialsInput = {
  token: Token;
  include_inactive?: boolean;
  others?: Record<string, any>;
};

export const listCredentialsValidation = type({
  token: tokenType,
  include_inactive: 'boolean?',
  others: 'object?',
});

export const listCredentialsStep: AuthStep<
  PasswordlessConfig,
  ListCredentialsInput,
  AuthOutput
> = {
  name: 'list-credentials',
  description: "List user's passwordless credentials",
  validationSchema: listCredentialsValidation,
  protocol: {
    http: {
      method: 'GET',
      codes: { su: 200, ic: 400, nf: 404 },
      auth: true,
    },
  },
  inputs: ['token', 'include_inactive', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'token?': tokenType,
    'credentials?': [
      type({
        id: 'string',
        name: 'string',
        created_at: 'string',
        last_used_at: 'string?',
        is_active: 'boolean',
        transports: 'string[]',
      }),
    ],
    'magic_links?': [
      type({
        id: 'string',
        email: 'string',
        created_at: 'string',
        expires_at: 'string',
      }),
    ],
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { token, include_inactive = false, others } = input;
    const orm = await ctx.engine.getOrm();

    const t = await ctx.engine.checkSession(token);

    try {
      // Check if subject exists
      const subject = await orm.findFirst('subjects', {
        where: (b: any) => b('id', '=', t.subject.id),
      });

      if (!subject) {
        return attachNewTokenIfDifferent(
          {
            success: false,
            message: 'Subject not found',
            status: 'nf',
          },
          token,
          t.token,
        );
      }

      const subject_id = subject.id;

      const result: any = {
        success: true,
        message: 'Credentials retrieved successfully',
        status: 'su',
        others,
      };

      // Get WebAuthn credentials if enabled
      if (ctx.config?.webauthn) {
        const whereClause = include_inactive
          ? (b: any) => b('subject_id', '=', subject_id)
          : (b: any) =>
              b.and(
                b('subject_id', '=', subject_id),
                b('is_active', '=', true),
              );

        const credentials = await orm.findMany('webauthn_credentials', {
          where: whereClause,
          orderBy: [['created_at', 'desc']],
        });

        result.credentials = credentials.map((cred: any) => {
          const createdAt = cred?.created_at
            ? cred.created_at instanceof Date
              ? cred.created_at.toISOString()
              : new Date(cred.created_at).toISOString()
            : undefined;
          const lastUsedAt = cred?.last_used_at
            ? cred.last_used_at instanceof Date
              ? cred.last_used_at.toISOString()
              : new Date(cred.last_used_at).toISOString()
            : undefined;
          const transports: string[] = Array.isArray(cred?.transports)
            ? cred.transports.map((t: any) => String(t))
            : [];
          return {
            id: cred.id,
            name: cred.name,
            created_at: createdAt || new Date(0).toISOString(),
            // last_used_at is optional; omit when null/undefined
            ...(typeof lastUsedAt !== 'undefined'
              ? { last_used_at: lastUsedAt }
              : {}),
            is_active: Boolean(cred.is_active),
            transports,
          };
        });
      }

      // Get active magic links if enabled
      if (ctx.config?.magicLinks) {
        const now = new Date();
        const magicLinks = await orm.findMany('magic_links', {
          where: (b: any) =>
            b.and(
              b('subject_id', '=', subject_id),
              b('expires_at', '>', now),
              b('used_at', '=', null),
            ),
          orderBy: [['created_at', 'desc']],
        });

        result.magic_links = magicLinks.map((link: any) => {
          const createdAt = link?.created_at
            ? link.created_at instanceof Date
              ? link.created_at.toISOString()
              : new Date(link.created_at).toISOString()
            : undefined;
          const expiresAt = link?.expires_at
            ? link.expires_at instanceof Date
              ? link.expires_at.toISOString()
              : new Date(link.expires_at).toISOString()
            : undefined;
          return {
            id: link.id,
            email: link.email,
            created_at: createdAt || new Date(0).toISOString(),
            expires_at: expiresAt || new Date(0).toISOString(),
          };
        });
      }

      return attachNewTokenIfDifferent(result, token, t.token);
    } catch (error) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Failed to retrieve credentials',
          status: 'ic',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        token,
        t.token,
      );
    }
  },
};
