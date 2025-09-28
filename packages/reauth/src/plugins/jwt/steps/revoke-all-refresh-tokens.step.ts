import { createAuthStep } from '../../../utils/create-step';
import type { AuthInput, AuthOutput } from '../../../types';
import type { JWTPluginConfig } from '../../../jwt.types';

export const revokeAllRefreshTokensStep = createAuthStep<JWTPluginConfig>({
  name: 'revoke-all-refresh-tokens',
  description: 'Revoke all refresh tokens for a subject (for logout all or security)',
  protocol: {
    http: {
      method: 'POST',
      codes: {
        su: 200, // success
        unf: 400, // validation failed
        ic: 500, // internal error
      },
      auth: true, // This step requires authentication to identify the subject
    },
  },
  async run(input: AuthInput, ctx) {
    const { subjectType, subjectId, reason = 'logout' } = input;

    if (!subjectType || !subjectId) {
      return {
        success: false,
        status: 'unf',
        message: 'subjectType and subjectId are required',
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
      
      if (!sessionService.revokeAllRefreshTokens) {
        return {
          success: false,
          status: 'ic',
          message: 'JWT refresh token revocation not enabled',
        };
      }

      const revokedCount = await sessionService.revokeAllRefreshTokens(
        subjectType,
        subjectId,
        reason
      );

      return {
        success: true,
        status: 'su',
        message: `${revokedCount} refresh tokens revoked successfully`,
        revokedCount,
        reason,
      };
    } catch (error) {
      return {
        success: false,
        status: 'ic',
        message: error instanceof Error ? error.message : 'Failed to revoke refresh tokens',
      };
    }
  },
});