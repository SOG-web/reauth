import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { PasswordlessConfigV2 } from '../types';

export type ListCredentialsInput = {
  subject_id: string;
  include_inactive?: boolean;
  others?: Record<string, any>;
};

export const listCredentialsValidation = type({
  subject_id: 'string',
  include_inactive: 'boolean?',
  others: 'object?',
});

export const listCredentialsStep: AuthStepV2<
  ListCredentialsInput,
  AuthOutput,
  PasswordlessConfigV2
> = {
  name: 'list-credentials',
  description: 'List user\'s passwordless credentials',
  validationSchema: listCredentialsValidation,
  protocol: {
    http: {
      method: 'GET',
      codes: { su: 200, ic: 400, nf: 404 },
    },
  },
  inputs: ['subject_id', 'include_inactive', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'credentials?': 'object[]',
    'magic_links?': 'object[]',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { subject_id, include_inactive = false, others } = input;
    const orm = await ctx.engine.getOrm();

    try {
      // Check if subject exists
      const subject = await orm.findFirst('subjects', {
        where: (b: any) => b('id', '=', subject_id),
      });

      if (!subject) {
        return {
          success: false,
          message: 'Subject not found',
          status: 'nf',
        };
      }

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
          : (b: any) => b.and(
              b('subject_id', '=', subject_id),
              b('is_active', '=', true)
            );

        const credentials = await orm.findMany('webauthn_credentials', {
          where: whereClause,
          orderBy: [['created_at', 'desc']],
        });

        result.credentials = credentials.map((cred: any) => ({
          id: cred.id,
          name: cred.name,
          created_at: cred.created_at,
          last_used_at: cred.last_used_at,
          is_active: cred.is_active,
          transports: cred.transports,
        }));
      }

      // Get active magic links if enabled
      if (ctx.config?.magicLinks) {
        const now = new Date();
        const magicLinks = await orm.findMany('magic_links', {
          where: (b: any) => b.and(
            b('subject_id', '=', subject_id),
            b('expires_at', '>', now),
            b('used_at', '=', null)
          ),
          orderBy: [['created_at', 'desc']],
        });

        result.magic_links = magicLinks.map((link: any) => ({
          id: link.id,
          email: link.email,
          created_at: link.created_at,
          expires_at: link.expires_at,
        }));
      }

      return result;
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve credentials',
        status: 'ic',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};