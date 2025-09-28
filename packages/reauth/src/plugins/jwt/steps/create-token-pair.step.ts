import { createAuthStep } from '../../../utils/create-step';
import type { AuthInput, AuthOutput } from '../../../types';
import type { JWTPluginConfig } from '../../../jwt.types';

export const createTokenPairStep = createAuthStep<JWTPluginConfig>({
  name: 'create-token-pair',
  description: 'Create a JWT access token and refresh token pair for authenticated user',
  protocol: {
    http: {
      method: 'POST',
      codes: {
        su: 200, // success
        unf: 400, // validation failed
        ic: 500, // internal error
      },
      auth: false, // This step creates tokens, so no auth required
    },
  },
  async run(input: AuthInput, ctx) {
    const { subjectType, subjectId, deviceInfo } = input;

    if (!subjectType || !subjectId) {
      return {
        success: false,
        status: 'unf',
        message: 'subjectType and subjectId are required',
      };
    }

    try {
      const sessionService = ctx.engine.getSessionService() as any;
      
      if (!sessionService.createJWTTokenPair) {
        return {
          success: false,
          status: 'ic',
          message: 'JWT token pair functionality not enabled',
        };
      }

      const tokenPair = await sessionService.createJWTTokenPair(
        subjectType,
        subjectId,
        deviceInfo ? {
          fingerprint: deviceInfo.fingerprint,
          ipAddress: deviceInfo.ipAddress,
          userAgent: deviceInfo.userAgent,
        } : undefined
      );

      return {
        success: true,
        status: 'su',
        message: 'JWT token pair created successfully',
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        tokenType: tokenPair.tokenType,
        accessTokenExpiresAt: tokenPair.accessTokenExpiresAt.toISOString(),
        refreshTokenExpiresAt: tokenPair.refreshTokenExpiresAt.toISOString(),
        expiresIn: ctx.config.defaultAccessTokenTtlSeconds,
      };
    } catch (error) {
      return {
        success: false,
        status: 'ic',
        message: error instanceof Error ? error.message : 'Failed to create JWT token pair',
      };
    }
  },
});