/**
 * Register Identity Provider Step
 * Registers new identity providers for SSO
 */

import { type } from 'arktype';
import type { AuthStepV2 } from '../../../types.v2';
import type { 
  SingleSignOnConfigV2, 
  RegisterIdentityProviderInput, 
  RegisterIdentityProviderOutput 
} from '../types';
import { CrossPlatformCrypto } from '../utils/crypto';

// Input validation schema
export const registerIdentityProviderValidation = type({
  name: 'string',
  type: '"saml" | "oidc" | "ws-federation" | "cas"',
  entityId: 'string',
  configuration: 'object',
  attributeMapping: 'object',
  securityConfig: 'object',
});

// Output schema
export const registerIdentityProviderOutputSchema = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  providerId: 'string?',
  name: 'string?',
  type: 'string?',
  isActive: 'boolean?',
  error: 'string?',
});

export const registerIdentityProviderStep: AuthStepV2<
  RegisterIdentityProviderInput,
  RegisterIdentityProviderOutput,
  SingleSignOnConfigV2
> = {
  name: 'register-identity-provider',
  description: 'Register new identity providers for SSO',
  validationSchema: registerIdentityProviderValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { 
        success: 201, 
        invalid_input: 400, 
        conflict: 409,
        server_error: 500 
      },
      auth: true, // Requires authentication
    },
  },
  inputs: ['name', 'type', 'entityId', 'configuration', 'attributeMapping', 'securityConfig'],
  outputs: registerIdentityProviderOutputSchema,

  async run(input: RegisterIdentityProviderInput, ctx): Promise<RegisterIdentityProviderOutput> {
    const { orm, config } = ctx;

    try {
      // Validate provider name is unique
      const existingProviders = await orm.findMany('sso_identity_providers', {
        where: (builder: any) => builder('name', '=', input.name),
        limit: 1,
      });

      if (existingProviders.length > 0) {
        return {
          success: false,
          message: `Identity provider with name '${input.name}' already exists`,
          status: 'conflict',
          error: 'PROVIDER_NAME_EXISTS',
        };
      }

      // Validate entity ID is unique
      const existingEntityIds = await orm.findMany('sso_identity_providers', {
        where: (builder: any) => builder('entity_id', '=', input.entityId),
        limit: 1,
      });

      if (existingEntityIds.length > 0) {
        return {
          success: false,
          message: `Identity provider with entity ID '${input.entityId}' already exists`,
          status: 'conflict',
          error: 'ENTITY_ID_EXISTS',
        };
      }

      // Validate configuration based on provider type
      const validationResult = this.validateProviderConfiguration(input.type, input.configuration);
      if (!validationResult.valid) {
        return {
          success: false,
          message: `Invalid configuration: ${validationResult.errors.join(', ')}`,
          status: 'invalid_input',
          error: 'INVALID_CONFIGURATION',
        };
      }

      // Validate attribute mapping
      const mappingValidation = this.validateAttributeMapping(input.attributeMapping);
      if (!mappingValidation.valid) {
        return {
          success: false,
          message: `Invalid attribute mapping: ${mappingValidation.errors.join(', ')}`,
          status: 'invalid_input',
          error: 'INVALID_ATTRIBUTE_MAPPING',
        };
      }

      // Validate security configuration
      const securityValidation = this.validateSecurityConfiguration(input.securityConfig);
      if (!securityValidation.valid) {
        return {
          success: false,
          message: `Invalid security configuration: ${securityValidation.errors.join(', ')}`,
          status: 'invalid_input',
          error: 'INVALID_SECURITY_CONFIG',
        };
      }

      // Create the provider
      const providerId = await CrossPlatformCrypto.generateId('provider');
      const now = new Date().toISOString();

      const providerData = {
        id: providerId,
        name: input.name,
        type: input.type,
        entity_id: input.entityId,
        configuration: JSON.stringify(input.configuration),
        attribute_mapping: JSON.stringify(input.attributeMapping),
        security_config: JSON.stringify(input.securityConfig),
        is_active: true,
        created_at: now,
        updated_at: now,
      };

      await orm.insert('sso_identity_providers', providerData);

      return {
        success: true,
        message: 'Identity provider registered successfully',
        status: 'success',
        providerId,
        name: input.name,
        type: input.type,
        isActive: true,
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to register identity provider',
        status: 'server_error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  /**
   * Validate provider configuration based on type
   */
  validateProviderConfiguration(
    type: string, 
    configuration: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (type) {
      case 'saml':
        if (!configuration.singleSignOnServiceUrl) {
          errors.push('singleSignOnServiceUrl is required for SAML providers');
        }
        if (!configuration.certificate) {
          errors.push('certificate is required for SAML providers');
        }
        if (!configuration.entityId) {
          errors.push('entityId is required for SAML providers');
        }
        break;

      case 'oidc':
        if (!configuration.issuer) {
          errors.push('issuer is required for OIDC providers');
        }
        if (!configuration.clientId) {
          errors.push('clientId is required for OIDC providers');
        }
        if (!configuration.clientSecret) {
          errors.push('clientSecret is required for OIDC providers');
        }
        break;

      case 'ws-federation':
        if (!configuration.realm) {
          errors.push('realm is required for WS-Federation providers');
        }
        if (!configuration.federationUrl) {
          errors.push('federationUrl is required for WS-Federation providers');
        }
        break;

      case 'cas':
        if (!configuration.casServerUrl) {
          errors.push('casServerUrl is required for CAS providers');
        }
        if (!configuration.serviceUrl) {
          errors.push('serviceUrl is required for CAS providers');
        }
        break;

      default:
        errors.push(`Unsupported provider type: ${type}`);
    }

    return { valid: errors.length === 0, errors };
  },

  /**
   * Validate attribute mapping configuration
   */
  validateAttributeMapping(
    attributeMapping: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required mappings
    if (!attributeMapping.userId && !attributeMapping.email) {
      errors.push('Either userId or email mapping is required');
    }

    // Validate mapping values are strings
    for (const [key, value] of Object.entries(attributeMapping)) {
      if (typeof value !== 'string') {
        errors.push(`Attribute mapping for '${key}' must be a string`);
      }
    }

    return { valid: errors.length === 0, errors };
  },

  /**
   * Validate security configuration
   */
  validateSecurityConfiguration(
    securityConfig: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate required security settings
    if (typeof securityConfig.validateSignature !== 'boolean') {
      errors.push('validateSignature must be a boolean');
    }

    if (typeof securityConfig.validateIssuer !== 'boolean') {
      errors.push('validateIssuer must be a boolean');
    }

    if (typeof securityConfig.validateAudience !== 'boolean') {
      errors.push('validateAudience must be a boolean');
    }

    // Validate numeric settings
    if (securityConfig.clockSkewSeconds !== undefined) {
      if (typeof securityConfig.clockSkewSeconds !== 'number' || securityConfig.clockSkewSeconds < 0) {
        errors.push('clockSkewSeconds must be a non-negative number');
      }
    }

    if (securityConfig.maxAuthenticationAge !== undefined) {
      if (typeof securityConfig.maxAuthenticationAge !== 'number' || securityConfig.maxAuthenticationAge < 0) {
        errors.push('maxAuthenticationAge must be a non-negative number');
      }
    }

    return { valid: errors.length === 0, errors };
  },
};