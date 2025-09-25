import { type } from 'arktype';
import type { AuthStepV2, OrmLike } from '../../../types.v2';
import type { GenericOAuthConfigV2 } from '../types';
import {
  OAuth1SignatureGenerator,
  buildOAuth1AuthorizationUrl,
  TokenEncryption,
} from '../utils';

const beginOAuth1AuthorizationInputSchema = type({
  providerId: 'string',
  callbackUri: 'string',
  'userId?': 'string', // For linking to existing user
});

const beginOAuth1AuthorizationOutputSchema = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  authorizationUrl: 'string',
  requestToken: 'string',
  'tokenSecret?': 'string', // Only returned if needed by client
});

export const beginOAuth1AuthorizationStep: AuthStepV2<
  typeof beginOAuth1AuthorizationInputSchema.infer,
  typeof beginOAuth1AuthorizationOutputSchema.infer,
  GenericOAuthConfigV2,
  OrmLike
> = {
  name: 'begin-oauth1-authorization',
  validationSchema: beginOAuth1AuthorizationInputSchema,
  inputs: ['providerId', 'callbackUri', 'userId'],
  outputs: beginOAuth1AuthorizationOutputSchema,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ic: 400, unf: 404 },
      auth: false,
    },
  },

  async run(input, ctx) {
    const { providerId, callbackUri, userId } = input;
    const orm = await ctx.engine.getOrm();

    try {
      // Get provider configuration
      const providerConfig = ctx.config?.providers?.[providerId];
      if (!providerConfig) {
        return {
          success: false,
          message: `OAuth provider '${providerId}' not found in configuration`,
          status: 'provider_not_found',
          authorizationUrl: '',
          requestToken: '',
        };
      }

      if (providerConfig.version !== '1.0a') {
        return {
          success: false,
          message: `Provider '${providerId}' is not configured for OAuth 1.0a`,
          status: 'invalid_oauth_version',
          authorizationUrl: '',
          requestToken: '',
        };
      }

      if (!providerConfig.isActive) {
        return {
          success: false,
          message: `OAuth provider '${providerId}' is not active`,
          status: 'provider_inactive',
          authorizationUrl: '',
          requestToken: '',
        };
      }

      if (!providerConfig.requestTokenUrl) {
        return {
          success: false,
          message: `Request token URL not configured for provider '${providerId}'`,
          status: 'missing_request_token_url',
          authorizationUrl: '',
          requestToken: '',
        };
      }

      // Get request token from provider
      const requestTokenResult = await simulateOAuth1RequestToken(
        providerConfig,
        callbackUri,
      );

      if (!requestTokenResult.success) {
        return {
          success: false,
          message: requestTokenResult.error || 'Failed to get request token',
          status: 'request_token_failed',
          authorizationUrl: '',
          requestToken: '',
        };
      }

      // Store request token securely
      const tokenSecretEncrypted = await TokenEncryption.encrypt(
        requestTokenResult.tokenSecret!,
      );
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      const tokenId = `oauth1_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      try {
        await orm.create('generic_oauth1_request_tokens', {
          id: tokenId,
          provider_id: providerId,
          token: requestTokenResult.token!,
          token_secret_encrypted: tokenSecretEncrypted,
          callback_confirmed: requestTokenResult.callbackConfirmed || false,
          expires_at: expiresAt,
          created_at: new Date(),
        });
      } catch (error) {
        return {
          success: false,
          message: 'Failed to store request token',
          status: 'token_storage_failed',
          authorizationUrl: '',
          requestToken: '',
        };
      }

      // Build authorization URL
      let authorizationUrl: string;
      try {
        authorizationUrl = await buildOAuth1AuthorizationUrl(
          providerConfig,
          requestTokenResult.token!,
          callbackUri,
        );
      } catch (error) {
        return {
          success: false,
          message: `Failed to build authorization URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 'url_build_failed',
          authorizationUrl: '',
          requestToken: '',
        };
      }

      return {
        success: true,
        message: 'OAuth 1.0a authorization flow initiated successfully',
        status: 'authorization_initiated',
        authorizationUrl,
        requestToken: requestTokenResult.token!,
      };
    } catch (error) {
      return {
        success: false,
        message: `OAuth 1.0a authorization initiation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'authorization_failed',
        authorizationUrl: '',
        requestToken: '',
      };
    }
  },
};

/**
 * Simulate OAuth 1.0a request token request (placeholder for HTTP transport)
 */
async function simulateOAuth1RequestToken(
  provider: any,
  callbackUri: string,
): Promise<{
  success: boolean;
  token?: string;
  tokenSecret?: string;
  callbackConfirmed?: boolean;
  error?: string;
}> {
  try {
    // In a real implementation, this would:
    // 1. Generate OAuth 1.0a signature
    // 2. Make POST request to provider.requestTokenUrl
    // 3. Include oauth_callback parameter
    // 4. Parse response for oauth_token and oauth_token_secret

    // Generate OAuth 1.0a parameters
    const timestamp = OAuth1SignatureGenerator.generateTimestamp();
    const nonce = await OAuth1SignatureGenerator.generateNonce();

    // Build parameters for signature
    const oauthParams = {
      oauth_callback: callbackUri,
      oauth_consumer_key: provider.clientId,
      oauth_nonce: nonce,
      oauth_signature_method: provider.signatureMethod || 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_version: '1.0',
    };

    // Generate signature (simplified simulation)
    const baseString = OAuth1SignatureGenerator.createSignatureBaseString(
      'POST',
      provider.requestTokenUrl,
      oauthParams,
    );

    // For simulation, return mock tokens
    const token = `oauth_request_token_${Date.now()}`;
    const tokenSecret = `oauth_token_secret_${Date.now()}`;

    return {
      success: true,
      token,
      tokenSecret,
      callbackConfirmed: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Request token failed',
    };
  }
}
