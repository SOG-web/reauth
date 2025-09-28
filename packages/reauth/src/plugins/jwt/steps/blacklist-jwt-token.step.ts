import { createAuthStep } from '../../../utils/create-step';
import type { AuthInput, AuthOutput } from '../../../types';
import type { JWTPluginConfig } from '../../../jwt.types';

export const blacklistJWTTokenStep = createAuthStep<JWTPluginConfig>({
  name: 'blacklist-jwt-token',
  description: 'Blacklist a JWT token (logout/revoke)',
  protocol: {
    http: {
      method: 'POST',
      codes: {
        su: 200, // success
        unf: 400, // validation failed
        ic: 500, // internal error
      },
      auth: true, // Requires authentication
    },
  },
  async run(input: AuthInput, ctx) {
    const { token, reason = 'logout' } = input;

    if (!token) {
      return {
        success: false,
        status: 'unf',
        message: 'Token is required',
      };
    }

    if (!['logout', 'revocation', 'security'].includes(reason)) {
      return {
        success: false,
        status: 'unf',
        message: 'Invalid reason. Must be one of: logout, revocation, security',
      };
    }

    try {
      const sessionService = ctx.engine.getSessionService() as any;
      
      if (!sessionService.blacklistJWTToken) {
        return {
          success: false,
          status: 'ic',
          message: 'JWT functionality not enabled',
        };
      }

      await sessionService.blacklistJWTToken(token, reason);

      return {
        success: true,
        status: 'su',
        message: 'Token blacklisted successfully',
        reason,
      };
    } catch (error) {
      return {
        success: false,
        status: 'ic',
        message: error instanceof Error ? error.message : 'Failed to blacklist token',
      };
    }
  },
});