import { type } from 'arktype';
import { type AuthStep, type AuthOutput, tokenType } from '../../../types';
import type { ApiKeyConfig } from '../types';
import { verifyApiKey, isValidApiKeyFormat, isApiKeyExpired } from '../utils';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export type AuthenticateApiKeyInput = {
  api_key: string;
  track_usage?: boolean; // Whether to log this authentication attempt
  endpoint?: string; // Optional endpoint for usage tracking
  ip_address?: string; // Optional IP for usage tracking
  user_agent?: string; // Optional user agent for usage tracking
  others?: Record<string, any>;
};

export const authenticateApiKeyValidation = type({
  api_key: 'string',
  track_usage: 'boolean?',
  endpoint: 'string?',
  ip_address: 'string?',
  user_agent: 'string?',
  'others?': 'object',
});

export const authenticateApiKeyStep: AuthStep<
  ApiKeyConfig,
  'authenticate-api-key',
  AuthenticateApiKeyInput,
  AuthOutput
> = {
  name: 'authenticate-api-key',
  description: 'Authenticate user with API key and create session',
  validationSchema: authenticateApiKeyValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: {
        unf: 401, // API key not found
        ip: 401, // Invalid API key
        exp: 401, // API key expired
        ina: 403, // API key inactive/revoked
        su: 200, // Success
        ic: 400, // Invalid input
      },
    },
  },
  inputs: [
    'api_key',
    'track_usage',
    'endpoint',
    'ip_address',
    'user_agent',
    'others',
  ],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'token?': tokenType,
    'subject?': type({
      id: 'string',
      provider: 'string',
      api_key_id: 'string',
      api_key_name: 'string',
      permissions: 'string[]',
      scopes: 'string[]',
    }),
    'api_key_id?': 'string',
    'others?': 'object',
  }),

  async run(input, ctx) {
    const { api_key, track_usage, endpoint, ip_address, user_agent, others } =
      input;
    const orm = await ctx.engine.getOrm();
    const config = ctx.config || {};

    // Validate API key format
    if (!isValidApiKeyFormat(api_key, config.keyPrefix)) {
      await logUsageIfEnabled(
        orm,
        null,
        endpoint,
        ip_address,
        user_agent,
        false,
        'Invalid API key format',
        config,
      );
      return {
        success: false,
        message: 'Invalid API key format',
        status: 'ip',
        others,
      };
    }

    // Find API key by hash lookup
    let apiKeyRecord;
    try {
      // We need to find all API keys and verify the hash since we can't query by hash directly
      const allActiveKeys = await orm.findMany('api_keys', {
        where: (b: any) => b('is_active', '=', true),
      });

      // Verify hash for each active key
      for (const key of allActiveKeys) {
        if (await verifyApiKey(api_key, key.key_hash as string)) {
          apiKeyRecord = key;
          break;
        }
      }
    } catch (error) {
      await logUsageIfEnabled(
        orm,
        null,
        endpoint,
        ip_address,
        user_agent,
        false,
        'Database error',
        config,
      );
      return {
        success: false,
        message: 'Authentication failed',
        status: 'unf',
        others,
      };
    }

    if (!apiKeyRecord) {
      await logUsageIfEnabled(
        orm,
        null,
        endpoint,
        ip_address,
        user_agent,
        false,
        'API key not found',
        config,
      );
      return {
        success: false,
        message: 'Invalid API key',
        status: 'unf',
        others,
      };
    }

    // Check if API key is active
    if (!apiKeyRecord.is_active) {
      await logUsageIfEnabled(
        orm,
        apiKeyRecord.id,
        endpoint,
        ip_address,
        user_agent,
        false,
        'API key revoked',
        config,
      );
      return {
        success: false,
        message: 'API key has been revoked',
        status: 'ina',
        others,
      };
    }

    // Check if API key is expired
    if (isApiKeyExpired(apiKeyRecord.expires_at)) {
      await logUsageIfEnabled(
        orm,
        apiKeyRecord.id,
        endpoint,
        ip_address,
        user_agent,
        false,
        'API key expired',
        config,
      );
      return {
        success: false,
        message: 'API key has expired',
        status: 'exp',
        others,
      };
    }

    // Update last used timestamp
    try {
      await orm.updateMany('api_keys', {
        where: (b: any) => b('id', '=', apiKeyRecord.id),
        set: {
          last_used_at: new Date(),
          updated_at: new Date(),
        },
      });
    } catch (error) {
      // Don't fail authentication if we can't update last_used_at
      console.warn('Failed to update API key last_used_at:', error);
    }

    // Log successful usage
    await logUsageIfEnabled(
      orm,
      apiKeyRecord.id,
      endpoint,
      ip_address,
      user_agent,
      true,
      null,
      config,
    );

    // Create session for the subject
    const ttl = config.defaultTtlDays
      ? config.defaultTtlDays * 24 * 60 * 60
      : 3600;
    const token = await ctx.engine.createSessionFor(
      'subject',
      apiKeyRecord.subject_id,
      ttl,
    );

    const subject = {
      id: apiKeyRecord.subject_id,
      provider: 'api-key',
      api_key_id: apiKeyRecord.id,
      api_key_name: apiKeyRecord.name,
      permissions: apiKeyRecord.permissions,
      scopes: apiKeyRecord.scopes,
    };

    const baseResult = {
      success: true,
      message: 'API key authentication successful',
      status: 'su',
      subject,
      api_key_id: apiKeyRecord.id,
      others,
    };

    // Attach session token if session/token changed
    return attachNewTokenIfDifferent(baseResult, undefined, token);
  },
};

// Helper function to log usage if tracking is enabled
async function logUsageIfEnabled(
  orm: any,
  apiKeyId: string | null,
  endpoint?: string,
  ipAddress?: string,
  userAgent?: string,
  success = true,
  errorMessage?: string | null,
  config: ApiKeyConfig = {},
): Promise<void> {
  if (!config.enableUsageTracking || !apiKeyId) return;

  try {
    await orm.create('api_key_usage', {
      api_key_id: apiKeyId,
      endpoint: endpoint || null,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      success,
      error_message: errorMessage || null,
    });
  } catch (error) {
    // Don't fail authentication if usage logging fails
    console.warn('Failed to log API key usage:', error);
  }
}
