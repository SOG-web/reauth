import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { ApiKeyConfigV2, ApiKeyMetadata } from '../types';
import { validateScopes, sanitizeApiKeyMetadata } from '../utils';

export type UpdateApiKeyInput = {
  token: string; // Required - must be authenticated
  api_key_id?: string; // Either api_key_id or name is required to identify the key
  name?: string; // Either api_key_id or name is required to identify the key
  new_name?: string; // Optional new name
  permissions?: string[]; // Optional new permissions
  scopes?: string[]; // Optional new scopes
  expires_at?: Date | null; // Optional new expiration (null to remove expiration)
  others?: Record<string, any>;
};

export const updateApiKeyValidation = type({
  token: 'string',
  api_key_id: 'string?',
  name: 'string?',
  new_name: 'string?',
  permissions: 'string[]?',
  scopes: 'string[]?',
  expires_at: 'Date?',
  others: 'object?',
});

export const updateApiKeyStep: AuthStepV2<
  UpdateApiKeyInput,
  AuthOutput & { data?: { api_key: ApiKeyMetadata } },
  ApiKeyConfigV2
> = {
  name: 'update-api-key',
  description:
    'Update API key permissions, scopes, or metadata for authenticated user',
  validationSchema: updateApiKeyValidation,
  protocol: {
    http: {
      method: 'PATCH',
      codes: {
        unauth: 401, // Not authenticated
        notfound: 404, // API key not found
        invalid: 400, // Invalid parameters or scopes
        conflict: 409, // New name already exists
        su: 200, // Success
        ic: 400, // Invalid input
      },
      auth: true, // Requires authentication
    },
  },
  inputs: [
    'token',
    'api_key_id',
    'name',
    'new_name',
    'permissions',
    'scopes',
    'expires_at',
    'others',
  ],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'data?': type({
      api_key: type({
        id: 'string',
        name: 'string',
        permissions: 'string[]',
        scopes: 'string[]',
        expires_at: 'Date',
        is_active: 'boolean',
        created_at: 'Date',
        updated_at: 'Date',
        last_used_at: 'Date',
      }),
    }), // Contains updated ApiKeyMetadata
    'others?': 'object',
  }),

  async run(input, ctx) {
    const {
      token,
      api_key_id,
      name,
      new_name,
      permissions,
      scopes,
      expires_at,
      others,
    } = input;
    const orm = await ctx.engine.getOrm();
    const config = ctx.config || {};

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
      return {
        success: false,
        message: 'Either api_key_id or name is required',
        status: 'invalid',
        others,
      };
    }

    // Must provide at least one field to update
    if (!new_name && !permissions && !scopes && expires_at === undefined) {
      return {
        success: false,
        message: 'At least one field to update must be provided',
        status: 'invalid',
        others,
      };
    }

    // Validate scopes if provided
    if (scopes) {
      const scopeErrors = validateScopes(scopes, config.allowedScopes);
      if (scopeErrors.length > 0) {
        return {
          success: false,
          message: `Invalid scopes: ${scopeErrors.join(', ')}`,
          status: 'invalid',
          others,
        };
      }
    }

    try {
      // Build where condition to find the API key
      const whereConditions = (b: any) => {
        const conditions = [
          b('subject_id', '=', subjectId),
          b('is_active', '=', true), // Only update active keys
        ];

        if (api_key_id) {
          conditions.push(b('id', '=', api_key_id));
        } else if (name) {
          conditions.push(b('name', '=', name));
        }

        return b.and(...conditions);
      };

      // Find the API key to update
      const apiKey = await orm.findFirst('api_keys', {
        where: whereConditions,
      });

      if (!apiKey) {
        return {
          success: false,
          message: api_key_id
            ? `API key with ID '${api_key_id}' not found or inactive`
            : `API key with name '${name}' not found or inactive`,
          status: 'notfound',
          others,
        };
      }

      // Check for name conflicts if new_name is provided
      if (new_name && new_name !== apiKey.name) {
        const existingKey = await orm.findFirst('api_keys', {
          where: (b: any) =>
            b.and(
              b('subject_id', '=', subjectId),
              b('name', '=', new_name),
              b('is_active', '=', true),
              b('id', '!=', apiKey.id), // Exclude the current key
            ),
        });

        if (existingKey) {
          return {
            success: false,
            message: 'API key name already exists',
            status: 'conflict',
            others,
          };
        }
      }

      // Build update data
      const updateData: any = {
        updated_at: new Date(),
      };

      if (new_name !== undefined) {
        updateData.name = new_name;
      }

      if (permissions !== undefined) {
        updateData.permissions =
          permissions.length > 0 ? JSON.stringify(permissions) : null;
      }

      if (scopes !== undefined) {
        updateData.scopes = scopes.length > 0 ? JSON.stringify(scopes) : null;
      }

      if (expires_at !== undefined) {
        updateData.expires_at = expires_at;
      }

      // Update the API key
      await orm.updateMany('api_keys', {
        where: (b: any) => b('id', '=', apiKey.id),
        set: updateData,
      });

      // Return the updated key (fetch fresh to ensure we have the latest data)
      const freshKey = await orm.findFirst('api_keys', {
        where: (b: any) => b('id', '=', apiKey.id),
      });

      const metadata = sanitizeApiKeyMetadata(freshKey);

      return {
        success: true,
        message: `API key '${metadata.name}' updated successfully`,
        status: 'su',
        data: {
          api_key: metadata,
        },
        others,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update API key',
        status: 'ic',
        error: String(error),
        others,
      };
    }
  },
};
