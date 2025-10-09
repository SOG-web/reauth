import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  type Token,
  tokenType,
} from '../../../types';
import type { ApiKeyConfig, ApiKeyMetadata } from '../types';
import { sanitizeApiKeyMetadata } from '../utils';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export type ListApiKeysInput = {
  token: Token; // Required - must be authenticated
  include_inactive?: boolean; // Whether to include revoked/inactive keys
  others?: Record<string, any>;
};

export const listApiKeysValidation = type({
  token: tokenType,
  include_inactive: 'boolean?',
  'others?': 'object',
});

export const listApiKeysStep: AuthStep<
  ApiKeyConfig,
  'list-api-keys',
  ListApiKeysInput,
  AuthOutput & { data?: { api_keys: ApiKeyMetadata[] } }
> = {
  name: 'list-api-keys',
  description: 'List API keys for authenticated user',
  validationSchema: listApiKeysValidation,
  protocol: {
    http: {
      method: 'GET',
      codes: {
        unauth: 401, // Not authenticated
        su: 200, // Success
        ic: 400, // Invalid input
      },
      auth: true, // Requires authentication
    },
  },
  inputs: ['token', 'include_inactive', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'data?': type({
      api_keys: type({
        id: 'string',
        name: 'string',
        permissions: 'string[]',
        scopes: 'string[]',
        expires_at: 'Date | string',
        is_active: 'boolean',
        created_at: 'Date | string',
        updated_at: 'Date | string',
        last_used_at: 'Date | string',
      }).array(), // Contains array of ApiKeyMetadata
    }),
    'others?': 'object',
    'token?': tokenType,
  }),

  async run(input, ctx) {
    const { token, include_inactive = false, others } = input;
    const orm = await ctx.engine.getOrm();

    // Verify authentication
    const session = await ctx.engine.checkSession(token);
    if (!session.valid || !session.subject) {
      return {
        success: false,
        message: 'Authentication required',
        status: 'unauth',
        others,
      };
    }

    const subjectId = session.subject.id;

    try {
      // Build query conditions
      const whereConditions = (b: any) => {
        const conditions = [b('subject_id', '=', subjectId)];

        if (!include_inactive) {
          conditions.push(b('is_active', '=', true));
        }

        return conditions.length === 1 ? conditions[0] : b.and(...conditions);
      };

      // Fetch API keys for this subject
      const apiKeys = await orm.findMany('api_keys', {
        where: whereConditions,
        orderBy: [
          'created_at',
          'desc', // Most recent first
        ],
      });

      // Sanitize the results (remove hashes and format dates)
      const sanitizedKeys = apiKeys.map(sanitizeApiKeyMetadata);

      return attachNewTokenIfDifferent(
        {
          success: true,
          message: `Found ${sanitizedKeys.length} API key(s)`,
          status: 'su',
          data: {
            api_keys: sanitizedKeys,
          },
          others,
        },
        token,
        session.token,
      );
    } catch (error) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Failed to retrieve API keys',
          status: 'ic',
          error: String(error),
          others,
        },
        token,
        session.token,
      );
    }
  },
};
