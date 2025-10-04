import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  type Token,
  tokenType,
} from '../../../types';
import type { ApiKeyConfig } from '../types';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export type RevokeApiKeyInput = {
  token: Token; // Required - must be authenticated
  api_key_id?: string; // Either api_key_id or name is required
  name?: string; // Either api_key_id or name is required
  others?: Record<string, any>;
};

export const revokeApiKeyValidation = type({
  token: tokenType,
  api_key_id: 'string?',
  name: 'string?',
  'others?': 'object | undefined',
});

export const revokeApiKeyStep: AuthStep<
  ApiKeyConfig,
  'revoke-api-key',
  RevokeApiKeyInput,
  AuthOutput
> = {
  name: 'revoke-api-key',
  description: 'Revoke (deactivate) an API key for authenticated user',
  validationSchema: revokeApiKeyValidation,
  protocol: {
    http: {
      method: 'DELETE',
      codes: {
        unauth: 401, // Not authenticated
        notfound: 404, // API key not found
        invalid: 400, // Missing required parameters
        su: 200, // Success
        ic: 400, // Invalid input
      },
      auth: true, // Requires authentication
    },
  },
  inputs: ['token', 'api_key_id', 'name', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'revoked_key_id?': 'string',
    'others?': 'object | undefined',
    'token?': tokenType,
  }),

  async run(input, ctx) {
    const { token, api_key_id, name, others } = input;
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

    // Must provide either api_key_id or name
    if (!api_key_id && !name) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Either api_key_id or name is required',
          status: 'invalid',
          others,
        },
        token,
        session.token,
      );
    }

    try {
      // Build where condition based on provided parameters
      const whereConditions = (b: any) => {
        const conditions = [
          b('subject_id', '=', subjectId),
          b('is_active', '=', true), // Only revoke active keys
        ];

        if (api_key_id) {
          conditions.push(b('id', '=', api_key_id));
        } else if (name) {
          conditions.push(b('name', '=', name));
        }

        return b.and(...conditions);
      };

      // Find the API key to revoke
      const apiKey = await orm.findFirst('api_keys', {
        where: whereConditions,
      });

      if (!apiKey) {
        return attachNewTokenIfDifferent(
          {
            success: false,
            message: api_key_id
              ? `API key with ID '${api_key_id}' not found or already inactive`
              : `API key with name '${name}' not found or already inactive`,
            status: 'notfound',
            others,
          },
          token,
          session.token,
        );
      }

      // Revoke the API key (mark as inactive)
      await orm.updateMany('api_keys', {
        where: (b: any) => b('id', '=', apiKey.id),
        set: {
          is_active: false,
          updated_at: new Date(),
        },
      });

      return attachNewTokenIfDifferent(
        {
          success: true,
          message: `API key '${apiKey.name}' has been revoked`,
          status: 'su',
          revoked_key_id: apiKey.id,
          others,
        },
        token,
        session.token,
      );
    } catch (error) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Failed to revoke API key',
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
