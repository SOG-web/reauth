import type { AuthStep } from '../../../types';
import type { JWTPluginConfig } from '../../../services';
import { type } from 'arktype';
import { verifyPasswordHash } from '../../../lib';

export type VerifyTokenInput = {
  token: string;
  client_id: string;
  client_secret?: string;
  others?: Record<string, any>;
};

export const verifyTokenValidation = type({
  token: 'string',
  client_id: 'string',
  'client_secret?': 'string',
  'others?': 'object',
});

export type VerifyTokenOutput = {
  success: boolean;
  message: string;
  status: string;
  valid?: boolean;
  payload?: Record<string, any>;
  error?: string;
};

export const verifyTokenStep: AuthStep<
  JWTPluginConfig,
  'verify-token',
  VerifyTokenInput,
  VerifyTokenOutput
> = {
  name: 'verify-token',
  description: 'Remotely verify a JWT token',
  validationSchema: verifyTokenValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: {
        su: 200, // success
        ua: 401, // unauthorized (invalid token)
        ic: 500, // internal error
      },
      auth: false, // Public endpoint (requires client credentials)
    },
  },
  inputs: ['token', 'client_id', 'client_secret', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'valid?': 'boolean',
    'payload?': 'object',
    'error?': 'string',
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

      // Verify client credentials
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

      // Verify the JWT token
      try {
        const payload = await jwksService.verifyJWT(input.token);

        return {
          success: true,
          status: 'su',
          message: 'Token verified successfully',
          valid: true,
          payload: payload as Record<string, any>,
          others,
        };
      } catch (error) {
        // Token is invalid or expired
        return {
          success: true, // Request succeeded, but token is invalid
          status: 'ua',
          message: 'Token verification failed',
          valid: false,
          error: error instanceof Error ? error.message : 'Token is invalid',
          others,
        };
      }
    } catch (error) {
      return {
        success: false,
        status: 'ic',
        message:
          error instanceof Error ? error.message : 'Failed to verify token',
        others,
      };
    }
  },
};
