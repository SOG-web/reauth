import { type } from 'arktype';
import type { AuthStepV2, AuthInputV2, AuthOutputV2, StepContextV2 } from '../../../types.v2';
import type { UsernameConfigV2 } from '../types';
import { verifyPasswordHash } from '../../../../lib/password';
import { usernameSchema } from '../../../../plugins/shared/validation';
import { passwordSchema } from '../../../../plugins/shared/validation';
import { findTestUser, isTestEnvironmentAllowed } from '../utils';

// Input schema
const loginInputSchema = type({
  username: usernameSchema,
  password: passwordSchema,
  others: 'object?',
});

// Output schema
const loginOutputSchema = type({
  success: 'boolean',
  message: 'string?',
  session: 'object?',
  subject: 'string?',
  others: 'object?',
});

interface LoginInput {
  username: string;
  password: string;
  others?: Record<string, any>;
}

interface LoginOutput {
  success: boolean;
  message?: string;
  session?: any;
  subject?: string;
  others?: Record<string, any>;
}

export const loginStep: AuthStepV2<LoginInput, LoginOutput> = {
  name: 'login',
  description: 'Authenticate user with username and password',
  inputs: loginInputSchema,
  outputs: loginOutputSchema,
  protocol: {
    method: 'POST',
    path: '/username/login',
    auth: false,
    statusCodes: {
      success: 200,
      error: 401,
      validation: 400,
    },
  },

  async run(input: LoginInput, context: StepContextV2): Promise<LoginOutput> {
    const { username, password, others } = input;
    const { container, config } = context;
    const usernameConfig = config as UsernameConfigV2;
    const entityService = container.cradle.entityService;
    const sessionService = container.cradle.sessionService;

    try {
      // Find identity by provider=username, identifier=username
      const identity = await entityService.findIdentity('username', username);
      
      if (!identity) {
        return {
          success: false,
          message: 'Invalid username or password',
          others,
        };
      }

      // Get credentials for password verification
      const credentials = await entityService.getCredentials(identity.subject_id);
      
      if (!credentials) {
        return {
          success: false,
          message: 'Invalid username or password',
          others,
        };
      }

      // Verify password using constant-time verification
      const passwordValid = await verifyPasswordHash(credentials.password_hash, password);
      
      if (!passwordValid) {
        return {
          success: false,
          message: 'Invalid username or password',
          others,
        };
      }

      // Username has no verification - proceed directly to session creation
      const session = await sessionService.createSession(
        identity.subject_id,
        usernameConfig.sessionTtlSeconds || 3600,
      );

      return {
        success: true,
        message: 'Login successful',
        session,
        subject: identity.subject_id,
        others,
      };

    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Login failed',
        others,
      };
    }
  },
};