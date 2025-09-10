import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { ApiKeyConfigV2, CreateApiKeyInput, CreateApiKeyOutput } from '../types';
import { 
  generateApiKey, 
  hashApiKey, 
  calculateExpirationDate, 
  validateScopes,
  checkApiKeyLimit,
  sanitizeApiKeyMetadata
} from '../utils';

export type CreateApiKeyStepInput = CreateApiKeyInput & {
  token: string; // Required - must be authenticated
  others?: Record<string, any>;
};

export const createApiKeyValidation = type({
  token: 'string',
  name: 'string',
  permissions: 'string[]?',
  scopes: 'string[]?',
  expires_at: 'Date?',
  ttl_days: 'number?',
  others: 'object?',
});

export const createApiKeyStep: AuthStepV2<
  CreateApiKeyStepInput,
  AuthOutput & { data?: CreateApiKeyOutput },
  ApiKeyConfigV2
> = {
  name: 'create-api-key',
  description: 'Create a new API key for authenticated user',
  validationSchema: createApiKeyValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { 
        unauth: 401, // Not authenticated
        limit: 429,  // Too many API keys
        conflict: 409, // Name already exists
        invalid: 400, // Invalid scopes or parameters
        su: 201,     // Created successfully
        ic: 400      // Invalid input
      },
      auth: true, // Requires authentication
    },
  },
  inputs: ['token', 'name', 'permissions', 'scopes', 'expires_at', 'ttl_days', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'data?': 'object', // Contains CreateApiKeyOutput
    'others?': 'object',
  }),
  
  async run(input, ctx) {
    const { token, name, permissions, scopes, expires_at, ttl_days, others } = input;
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

    // Check if scopes are required but not provided
    if (config.requireScopes && (!scopes || scopes.length === 0)) {
      return {
        success: false,
        message: 'Scopes are required',
        status: 'invalid',
        others,
      };
    }

    // Check API key limit
    if (await checkApiKeyLimit(orm, subjectId, config.maxKeysPerUser)) {
      return {
        success: false,
        message: `Maximum number of API keys reached (${config.maxKeysPerUser})`,
        status: 'limit',
        others,
      };
    }

    // Check for name conflicts
    try {
      const existingKey = await orm.findFirst('api_keys', {
        where: (b: any) => b.and(
          b('subject_id', '=', subjectId),
          b('name', '=', name),
          b('is_active', '=', true)
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
    } catch (error) {
      return {
        success: false,
        message: 'Database error checking name conflicts',
        status: 'ic',
        others,
      };
    }

    // Generate and hash the API key
    const apiKey = generateApiKey(config);
    const keyHash = await hashApiKey(apiKey);

    // Calculate expiration date
    let expirationDate: Date | null = null;
    if (expires_at) {
      expirationDate = new Date(expires_at);
    } else if (ttl_days) {
      expirationDate = calculateExpirationDate(ttl_days);
    } else if (config.defaultTtlDays) {
      expirationDate = calculateExpirationDate(config.defaultTtlDays);
    }

    // Create the API key record
    try {
      const apiKeyRecord = await orm.create('api_keys', {
        subject_id: subjectId,
        name,
        key_hash: keyHash,
        permissions: permissions ? JSON.stringify(permissions) : null,
        scopes: scopes ? JSON.stringify(scopes) : null,
        expires_at: expirationDate,
        is_active: true,
      });

      const metadata = sanitizeApiKeyMetadata(apiKeyRecord);

      const createOutput: CreateApiKeyOutput = {
        api_key: apiKey, // The actual key - only returned once!
        metadata,
      };

      return {
        success: true,
        message: 'API key created successfully',
        status: 'su',
        data: createOutput,
        others,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create API key',
        status: 'ic',
        error: String(error),
        others,
      };
    }
  },
};