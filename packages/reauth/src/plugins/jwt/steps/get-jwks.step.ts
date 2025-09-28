import { createAuthStep } from '../../../utils/create-step';
import type { AuthInput, AuthOutput } from '../../../types';
import type { JWTPluginConfig } from '../../../jwt.types';

export const getJWKSStep = createAuthStep<JWTPluginConfig>({
  name: 'get-jwks',
  description: 'Get public JWKS keys for JWT verification',
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
  async run(input: AuthInput, ctx) {
    try {
      const sessionService = ctx.engine.getSessionService() as any;
      
      if (!sessionService.getPublicJWKS) {
        return {
          success: false,
          status: 'ic',
          message: 'JWT functionality not enabled',
        };
      }

      const jwks = await sessionService.getPublicJWKS();

      return {
        success: true,
        status: 'su',
        message: 'JWKS retrieved successfully',
        ...jwks, // Spread the keys array
      };
    } catch (error) {
      return {
        success: false,
        status: 'ic',
        message: error instanceof Error ? error.message : 'Failed to retrieve JWKS',
      };
    }
  },
});