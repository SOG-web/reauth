import type { AuthStep } from '../../../types';
import type { JWTPluginConfig } from '../../../services';
import { type } from 'arktype';
import { verifyPasswordHash } from '../../../lib';
import { JWK } from 'jose';

export type GetJWKSByKidInput = {
  client_id: string;
  client_secret?: string;
  kid?: string; // Optional: if provided, return specific key; otherwise return all active keys
  others?: Record<string, any>;
};

export const getJWKSByKidValidation = type({
  client_id: 'string',
  'client_secret?': 'string',
  'kid?': 'string',
  'others?': 'object',
});

export type GetJWKSByKidOutput = {
  success: boolean;
  message: string;
  status: string;
  keys?: JWK[]; // Array of keys (JWKS format)
  jwk?: JWK; // Single key if kid was provided
};

export const getJWKSByKidStep: AuthStep<
  JWTPluginConfig,
  'get-jwks-by-kid',
  GetJWKSByKidInput,
  GetJWKSByKidOutput
> = {
  name: 'get-jwks-by-kid',
  description: 'Get public JWKS keys by key ID or all active keys',
  validationSchema: getJWKSByKidValidation,
  protocol: {
    http: {
      method: 'GET',
      codes: {
        su: 200, // success
        nf: 404, // key not found
        ic: 500, // internal error
      },
      auth: false, // Public endpoint
    },
  },
  inputs: ['client_id', 'client_secret', 'kid', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'keys?': 'object[]',
    'jwk?': 'object',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const others = input.others || {};
    try {
      const sessionService = ctx.engine.getSessionService();

      if (!sessionService.getPublicJWKS) {
        return {
          success: false,
          status: 'ic',
          message: 'JWT functionality not enabled',
          others,
        };
      }

      const jwksService = sessionService.getJwkService();

      if (!jwksService) {
        return {
          success: false,
          status: 'ic',
          message: 'JWT functionality not enabled',
          others,
        };
      }

      let client = await jwksService.getClientById(input.client_id);

      if (!client || client.clientType !== 'confidential') {
        return {
          success: false,
          status: 'ic',
          message: 'Client not found or not confidential',
          others,
        };
      }

      if (input.client_secret) {
        const clientSecretHash = await verifyPasswordHash(
          client.clientSecretHash as string,
          input.client_secret,
        );

        if (!clientSecretHash) {
          return {
            success: false,
            status: 'ic',
            message: 'Invalid client secret',
            others,
          };
        }
      }

      // If kid is provided, return specific key
      if (input.kid) {
        const allKeys = await jwksService.getPublicJWKS();
        const specificKey = allKeys.keys.find((key) => key.kid === input.kid);

        if (!specificKey) {
          return {
            success: false,
            status: 'nf',
            message: `Key with kid ${input.kid} not found`,
            others,
          };
        }

        return {
          success: true,
          status: 'su',
          message: 'JWKS key retrieved successfully',
          jwk: specificKey,
          others,
        };
      }

      // Otherwise, return all active keys
      const jwks = await jwksService.getPublicJWKS();

      return {
        success: true,
        status: 'su',
        message: 'JWKS keys retrieved successfully',
        keys: jwks.keys,
        others,
      };
    } catch (error) {
      return {
        success: false,
        status: 'ic',
        message:
          error instanceof Error ? error.message : 'Failed to retrieve JWKS',
        others,
      };
    }
  },
};

