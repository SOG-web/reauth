import { createAuthStep } from '../../../utils/create-step';
import type { AuthInput, AuthOutput } from '../../../types';
import type { JWTPluginConfig } from '../../../jwt.types';

export const refreshAccessTokenStep = createAuthStep<JWTPluginConfig>({
  name: 'refresh-access-token',
  description: 'Exchange a refresh token for a new access token',
  protocol: {
    http: {
      method: 'POST',
      codes: {
        su: 200, // success
        unf: 400, // validation failed
        unauth: 401, // invalid refresh token
        ic: 500, // internal error
      },
      auth: false, // This step uses refresh token for auth
    },
  },
  async run(input: AuthInput, ctx) {
    const { refreshToken } = input;

    if (!refreshToken) {
      return {
        success: false,
        status: 'unf',
        message: 'refreshToken is required',
      };
    }

    try {
      const sessionService = ctx.engine.getSessionService() as any;
      
      if (!sessionService.refreshJWTTokenPair) {
        return {
          success: false,
          status: 'ic',
          message: 'JWT refresh functionality not enabled',
        };
      }

      const tokenPair = await sessionService.refreshJWTTokenPair(refreshToken);

      return {
        success: true,
        status: 'su',
        message: 'Access token refreshed successfully',
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        tokenType: tokenPair.tokenType,
        accessTokenExpiresAt: tokenPair.accessTokenExpiresAt.toISOString(),
        refreshTokenExpiresAt: tokenPair.refreshTokenExpiresAt.toISOString(),
        expiresIn: ctx.config.defaultAccessTokenTtlSeconds,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh access token';
      
      // Check if it's an invalid token error
      if (errorMessage.includes('Invalid') || errorMessage.includes('expired')) {
        return {
          success: false,
          status: 'unauth',
          message: errorMessage,
        };
      }

      return {
        success: false,
        status: 'ic',
        message: errorMessage,
      };
    }
  },
});