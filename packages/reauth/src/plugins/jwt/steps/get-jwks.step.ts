import type { AuthInput, AuthOutput, AuthStep } from '../../../types';
import type { JWTPluginConfig } from '../../../services';
import { type } from 'arktype';
import { hashPassword, verifyPasswordHash } from '../../../lib';
import { JWK } from 'jose';

export type GetJWKSInput = {
  client_id: string;
  client_secret?: string;
  others?: Record<string, any>;
};

export const getJWKSValidation = type({
  client_id: 'string',
  'client_secret?': 'string',
  'others?': 'object | undefined',
});

export type GetJWKSOutput = {
  success: boolean;
  message: string;
  status: string;
  jwk?: JWK;
};

export const getJWKSStep: AuthStep<
  JWTPluginConfig,
  'get-jwks',
  GetJWKSInput,
  GetJWKSOutput
> = {
  name: 'get-jwks',
  description: 'Get public JWKS keys for JWT verification',
  validationSchema: getJWKSValidation,
  protocol: {
    http: {
      method: 'GET',
      codes: {
        su: 200, // success
        ic: 500, // internal error
      },
      auth: false, // Public endpoint
    },
  },
  inputs: ['client_id', 'client_secret', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'jwk?': 'object',
    'others?': 'object | undefined',
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

      const jwks = await jwksService.getPublicJWK();

      return {
        success: true,
        status: 'su',
        message: 'JWKS retrieved successfully',
        jwk: jwks,
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
