import { createAuthStep } from '../../../utils/create-step';
import type { AuthInput, AuthOutput } from '../../../types';
import type { JWTPluginConfig } from '../../../jwt.types';

export const verifyJWTTokenStep = createAuthStep<JWTPluginConfig>({
  name: 'verify-jwt-token',
  description: 'Verify a JWT token and return user information',
  protocol: {
    http: {
      method: 'POST',
      codes: {
        su: 200, // success
        unf: 400, // validation failed
        unauth: 401, // unauthorized
        ic: 500, // internal error
      },
      auth: false, // This step verifies tokens
    },
  },
  async run(input: AuthInput, ctx) {
    const { token } = input;

    if (!token) {
      return {
        success: false,
        status: 'unf',
        message: 'Token is required',
      };
    }

    try {
      const sessionService = ctx.engine.getSessionService() as any;
      
      if (!sessionService.verifyJWTSession) {
        return {
          success: false,
          status: 'ic',
          message: 'JWT functionality not enabled',
        };
      }

      const result = await sessionService.verifyJWTSession(token);

      if (!result.subject) {
        return {
          success: false,
          status: 'unauth',
          message: 'Invalid or expired token',
        };
      }

      return {
        success: true,
        status: 'su',
        message: 'Token verified successfully',
        subject: result.subject,
        payload: result.payload,
        token: result.token,
      };
    } catch (error) {
      return {
        success: false,
        status: 'unauth',
        message: error instanceof Error ? error.message : 'Token verification failed',
      };
    }
  },
});