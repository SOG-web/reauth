import { createAuthStep } from '../../../utils/create-step';
import type { AuthInput, AuthOutput } from '../../../types';
import type { JWTPluginConfig } from '../../../jwt.types';

export const revokeRefreshTokenStep = createAuthStep<JWTPluginConfig>({
  name: 'revoke-refresh-token',
  description: 'Revoke a refresh token (for logout or security)',
  protocol: {
    http: {
      method: 'POST',
      codes: {
        su: 200, // success
        unf: 400, // validation failed
        ic: 500, // internal error
      },
      auth: false, // This step can be called without auth for logout
    },
  },
  async run(input: AuthInput, ctx) {
    const { refreshToken, reason = 'logout' } = input;

    if (!refreshToken) {
      return {
        success: false,
        status: 'unf',
        message: 'refreshToken is required',
      };
    }

    // Validate reason
    const validReasons = ['logout', 'rotation', 'security', 'expired'];
    if (!validReasons.includes(reason)) {
      return {
        success: false,
        status: 'unf',
        message: `Invalid reason. Must be one of: ${validReasons.join(', ')}`,
      };
    }

    try {
      const sessionService = ctx.engine.getSessionService() as any;
      
      if (!sessionService.revokeRefreshToken) {
        return {
          success: false,
          status: 'ic',
          message: 'JWT refresh token revocation not enabled',
        };
      }

      await sessionService.revokeRefreshToken(refreshToken, reason);

      return {
        success: true,
        status: 'su',
        message: 'Refresh token revoked successfully',
        reason,
      };
    } catch (error) {
      return {
        success: false,
        status: 'ic',
        message: error instanceof Error ? error.message : 'Failed to revoke refresh token',
      };
    }
  },
});