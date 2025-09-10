import { type } from 'arktype';
import type { AuthStepV2, AuthInputV2, AuthOutputV2, StepContextV2 } from '../../../types.v2';
import type { UsernameConfigV2 } from '../types';
import { hashPassword, haveIbeenPawned } from '../../../../lib/password';
import { usernameSchema } from '../../../../plugins/shared/validation';
import { passwordSchema } from '../../../../plugins/shared/validation';
import { findTestUser, isTestEnvironmentAllowed } from '../utils';

// Input schema
const registerInputSchema = type({
  username: usernameSchema,
  password: passwordSchema,
  others: 'object?',
});

// Output schema
const registerOutputSchema = type({
  success: 'boolean',
  message: 'string?',
  session: 'object?',
  subject: 'string?',
  others: 'object?',
});

interface RegisterInput {
  username: string;
  password: string;
  others?: Record<string, any>;
}

interface RegisterOutput {
  success: boolean;
  message?: string;
  session?: any;
  subject?: string;
  others?: Record<string, any>;
}

export const registerStep: AuthStepV2<RegisterInput, RegisterOutput> = {
  name: 'register',
  description: 'Register new user with username and password',
  inputs: registerInputSchema,
  outputs: registerOutputSchema,
  protocol: {
    method: 'POST',
    path: '/username/register',
    auth: false,
    statusCodes: {
      success: 201,
      error: 400,
      validation: 400,
    },
  },

  async run(input: RegisterInput, context: StepContextV2): Promise<RegisterOutput> {
    const { username, password, others } = input;
    const { container, config } = context;
    const usernameConfig = config as UsernameConfigV2;
    const entityService = container.cradle.entityService;
    const sessionService = container.cradle.sessionService;

    try {
      // Check if username already exists
      const existingIdentity = await entityService.findIdentity('username', username);
      
      if (existingIdentity) {
        return {
          success: false,
          message: 'Username already taken',
          others,
        };
      }

      // Password safety check using HaveIBeenPwned
      const passwordSafe = await haveIbeenPawned(password);
      if (!passwordSafe) {
        return {
          success: false,
          message: 'Password has been compromised. Please choose a different password.',
          others,
        };
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create subject
      const subject = await entityService.createSubject({
        role: 'user',
      });

      // Set credentials
      await entityService.setCredentials(subject.id, passwordHash);

      // Create identity - username is always verified since no verification flow
      const identity = await entityService.createIdentity({
        subject_id: subject.id,
        provider: 'username',
        identifier: username,
        verified: true,
      });

      // Create session if loginOnRegister is enabled
      let session;
      if (usernameConfig.loginOnRegister) {
        session = await sessionService.createSession(
          subject.id,
          usernameConfig.sessionTtlSeconds || 3600,
        );
      }

      return {
        success: true,
        message: 'Registration successful',
        session,
        subject: subject.id,
        others,
      };

    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Registration failed',
        others,
      };
    }
  },
};