import { createAuthStep } from '../../../utils/create-step';
import type { AuthInput, AuthOutput } from '../../../types';
import type { JWTPluginConfig } from '../../../jwt.types';

export const createJWTTokenStep = createAuthStep<JWTPluginConfig>({
  name: 'create-jwt-token',
  description: 'Create a JWT token for authenticated user',
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
    const { subjectType, subjectId } = input;

    if (!subjectType || !subjectId) {
      return {
        success: false,
        status: 'unf',
        message: 'subjectType and subjectId are required',
      };
    }

    try {
      const sessionService = ctx.engine.getSessionService() as any;
      
      if (!sessionService.createJWTSession) {
        return {
          success: false,
          status: 'ic',
          message: 'JWT functionality not enabled',
        };
      }

      const token = await sessionService.createJWTSession(
        subjectType,
        subjectId,
        ctx.config.defaultAccessTokenTtlSeconds,
      );

      return {
        success: true,
        status: 'su',
        message: 'JWT token created successfully',
        token,
        tokenType: 'Bearer',
        expiresIn: ctx.config.defaultAccessTokenTtlSeconds,
      };
    } catch (error) {
      return {
        success: false,
        status: 'ic',
        message: error instanceof Error ? error.message : 'Failed to create JWT token',
      };
    }
  },
});