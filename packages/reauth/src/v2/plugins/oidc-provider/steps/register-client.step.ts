/**
 * OIDC Client Registration Step V2
 * Implements Dynamic Client Registration as per RFC 7591
 */

import { type, string, array } from 'arktype';
import { createStepV2 } from '../../../utils/create-step.v2';
import type { OIDCProviderConfigV2 } from '../types';
import { 
  generateClientId, 
  generateClientSecret, 
  hashToken,
  validateRedirectUri,
  generateSecureRandom 
} from '../utils';

// Input schema for client registration
const RegisterClientInput = type({
  clientName: string,
  redirectUris: array(string),
  clientUri: string.optional(),
  logoUri: string.optional(),
  tosUri: string.optional(),
  policyUri: string.optional(),
  jwksUri: string.optional(),
  jwks: 'unknown',
  grantTypes: array(string).optional(),
  responseTypes: array(string).optional(),
  scope: string.optional(),
  tokenEndpointAuthMethod: string.optional(),
  contacts: array(string).optional(),
  applicationType: string.optional(),
  subjectType: string.optional(),
});

// Output schema for client registration response
const RegisterClientOutput = type({
  success: 'true',
  status: '"client_registered" | "invalid_request" | "invalid_redirect_uri" | "invalid_client_metadata" | "server_error"',
  message: 'string',
  clientId: string.optional(),
  clientSecret: string.optional(),
  clientIdIssuedAt: 'number | undefined',
  clientSecretExpiresAt: 'number | undefined',
  registrationAccessToken: string.optional(),
});

/**
 * Register Client Step
 * 
 * Dynamically registers a new OIDC client according to RFC 7591.
 * Creates a new client with the specified metadata and returns client credentials.
 * 
 * @example
 * ```typescript
 * const result = await engine.executeStep('register-client', {
 *   clientName: 'My Application',
 *   redirectUris: ['https://app.example.com/callback'],
 *   grantTypes: ['authorization_code'],
 *   responseTypes: ['code']
 * });
 * ```
 */
export const registerClientStep = createStepV2({
  name: 'register-client',
  
  inputs: RegisterClientInput,
  outputs: RegisterClientOutput,
  
  protocol: 'oidc-provider.register-client.v1',
  
  meta: {
    http: {
      method: 'POST',
      codes: {
        client_registered: 201,
        invalid_request: 400,
        invalid_redirect_uri: 400,
        invalid_client_metadata: 400,
        server_error: 500,
      },
      auth: false, // Public endpoint or controlled via other means
    },
  },

  async handler(input, { orm, config }) {
    const {
      clientName,
      redirectUris,
      clientUri,
      logoUri,
      tosUri,
      policyUri,
      jwksUri,
      jwks,
      grantTypes,
      responseTypes,
      scope,
      tokenEndpointAuthMethod,
      contacts,
      applicationType,
      subjectType,
    } = input;
    
    const oidcConfig = config as OIDCProviderConfigV2;

    try {
      // 1. Check if dynamic client registration is enabled
      if (!oidcConfig.features.dynamicClientRegistration) {
        return {
          success: false as const,
          status: 'invalid_request' as const,
          message: 'Dynamic client registration not supported',
        };
      }

      // 2. Validate redirect URIs
      if (!redirectUris || redirectUris.length === 0) {
        return {
          success: false as const,
          status: 'invalid_redirect_uri' as const,
          message: 'At least one redirect URI is required',
        };
      }

      for (const uri of redirectUris) {
        if (!validateRedirectUri(uri, oidcConfig.security.allowInsecureRedirectUris)) {
          return {
            success: false as const,
            status: 'invalid_redirect_uri' as const,
            message: `Invalid redirect URI: ${uri}`,
          };
        }
      }

      // 3. Validate and set defaults for grant types and response types
      const finalGrantTypes = grantTypes || oidcConfig.clientDefaults.grantTypes;
      const finalResponseTypes = responseTypes || oidcConfig.clientDefaults.responseTypes;
      
      // Validate grant types
      const supportedGrantTypes = ['authorization_code', 'implicit', 'refresh_token', 'client_credentials'];
      for (const grantType of finalGrantTypes) {
        if (!supportedGrantTypes.includes(grantType)) {
          return {
            success: false as const,
            status: 'invalid_client_metadata' as const,
            message: `Unsupported grant type: ${grantType}`,
          };
        }
      }

      // Validate response types
      const supportedResponseTypes = ['code', 'id_token', 'token'];
      for (const responseType of finalResponseTypes) {
        const types = responseType.split(' ');
        for (const type of types) {
          if (!supportedResponseTypes.includes(type)) {
            return {
              success: false as const,
              status: 'invalid_client_metadata' as const,
              message: `Unsupported response type: ${responseType}`,
            };
          }
        }
      }

      // 4. Validate application type
      const finalApplicationType = applicationType || 'web';
      if (!['web', 'native'].includes(finalApplicationType)) {
        return {
          success: false as const,
          status: 'invalid_client_metadata' as const,
          message: 'Application type must be "web" or "native"',
        };
      }

      // 5. Validate subject type
      const finalSubjectType = subjectType || 'public';
      if (!['public', 'pairwise'].includes(finalSubjectType)) {
        return {
          success: false as const,
          status: 'invalid_client_metadata' as const,
          message: 'Subject type must be "public" or "pairwise"',
        };
      }

      // 6. Validate token endpoint auth method
      const finalAuthMethod = tokenEndpointAuthMethod || oidcConfig.clientDefaults.tokenEndpointAuthMethod;
      const supportedAuthMethods = ['client_secret_basic', 'client_secret_post', 'private_key_jwt', 'none'];
      if (!supportedAuthMethods.includes(finalAuthMethod)) {
        return {
          success: false as const,
          status: 'invalid_client_metadata' as const,
          message: `Unsupported token endpoint auth method: ${finalAuthMethod}`,
        };
      }

      // 7. Parse and validate scopes
      const requestedScopes = scope ? scope.split(' ') : oidcConfig.clientDefaults.defaultScopes;
      const configuredScopes = Object.keys(oidcConfig.scopes);
      const validScopes = requestedScopes.filter(s => configuredScopes.includes(s));
      
      if (!validScopes.includes('openid')) {
        validScopes.unshift('openid');
      }

      // 8. Generate client credentials
      const clientId = generateClientId();
      const needsSecret = finalAuthMethod !== 'none' && !['native'].includes(finalApplicationType);
      
      let clientSecret: string | undefined;
      let clientSecretHash: string | undefined;
      
      if (needsSecret) {
        clientSecret = generateClientSecret();
        clientSecretHash = await hashToken(clientSecret);
      }

      // 9. Create client record
      const clientRecord = {
        id: generateSecureRandom(16),
        client_id: clientId,
        client_secret_hash: clientSecretHash || null,
        client_name: clientName,
        client_uri: clientUri || null,
        logo_uri: logoUri || null,
        tos_uri: tosUri || null,
        policy_uri: policyUri || null,
        jwks_uri: jwksUri || null,
        jwks: jwks ? JSON.stringify(jwks) : null,
        redirect_uris: JSON.stringify(redirectUris),
        post_logout_redirect_uris: JSON.stringify([]),
        grant_types: JSON.stringify(finalGrantTypes),
        response_types: JSON.stringify(finalResponseTypes),
        scopes: JSON.stringify(validScopes),
        token_endpoint_auth_method: finalAuthMethod,
        id_token_signed_response_alg: oidcConfig.tokens.signingAlgorithm,
        userinfo_signed_response_alg: null,
        request_object_signing_alg: null,
        application_type: finalApplicationType,
        subject_type: finalSubjectType,
        sector_identifier_uri: null,
        require_auth_time: false,
        default_max_age: null,
        require_pushed_authorization_requests: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      await orm.insertOne('oidc_clients', clientRecord);

      // 10. Prepare response
      const issuedAt = Math.floor(Date.now() / 1000);
      
      return {
        success: true as const,
        status: 'client_registered' as const,
        message: 'Client registered successfully',
        clientId,
        clientSecret,
        clientIdIssuedAt: issuedAt,
        clientSecretExpiresAt: undefined, // Secrets don't expire by default
        registrationAccessToken: undefined, // Not implemented yet
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false as const,
        status: 'server_error' as const,
        message: `Client registration failed: ${errorMessage}`,
      };
    }
  },
});