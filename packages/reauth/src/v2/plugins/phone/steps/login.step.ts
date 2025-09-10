import { type } from 'arktype';
import type { AuthStepV2, AuthInputV2, AuthOutputV2, StepContextV2 } from '../../../types.v2';
import type { PhoneConfigV2 } from '../types';
import { hashPassword, verifyPasswordHash } from '../../../../lib/password';
import { phoneSchema } from '../../../../plugins/shared/validation';
import { passwordSchema } from '../../../../plugins/shared/validation';
import { findTestUser, isTestEnvironmentAllowed, genCode, generateId } from '../utils';

// Input schema
const loginInputSchema = type({
  phone: phoneSchema,
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
  phone: string;
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
  description: 'Authenticate user with phone and password',
  inputs: loginInputSchema,
  outputs: loginOutputSchema,
  protocol: {
    method: 'POST',
    path: '/phone/login',
    auth: false,
    statusCodes: {
      success: 200,
      error: 401,
      validation: 400,
    },
  },

  async run(input: LoginInput, context: StepContextV2): Promise<LoginOutput> {
    const { phone, password, others } = input;
    const { container, config } = context;
    const phoneConfig = config as PhoneConfigV2;
    const entityService = container.cradle.entityService;
    const sessionService = container.cradle.sessionService;

    try {
      // Find identity by provider=phone, identifier=phone
      const identity = await entityService.findIdentity('phone', phone);
      
      if (!identity) {
        return {
          success: false,
          message: 'Invalid phone or password',
          others,
        };
      }

      // Get credentials for password verification
      const credentials = await entityService.getCredentials(identity.subject_id);
      
      if (!credentials) {
        return {
          success: false,
          message: 'Invalid phone or password',
          others,
        };
      }

      // Verify password using constant-time verification
      const passwordValid = await verifyPasswordHash(credentials.password_hash, password);
      
      if (!passwordValid) {
        return {
          success: false,
          message: 'Invalid phone or password',
          others,
        };
      }

      // Post-password verification gating: only send verification codes AFTER successful password validation
      if (phoneConfig.verifyPhone && !identity.verified) {
        // Check if test user and environment allows
        const isTestUser = findTestUser(phone, phoneConfig.testUsers || { enabled: false, environmentGating: false, users: [] });
        const testEnvAllowed = isTestEnvironmentAllowed(phoneConfig.testUsers || { enabled: false, environmentGating: false, users: [] });
        
        if (isTestUser && testEnvAllowed) {
          // Test user path - auto-verify
          await entityService.updateIdentity(identity.id, { verified: true });
        } else {
          // Generate verification code and store hashed
          const code = genCode(phoneConfig.codeLength || 6);
          const hashedCode = await hashPassword(code);
          const expiresAt = new Date(Date.now() + (phoneConfig.verificationCodeExpiresIn || 900) * 1000);
          
          // TODO: Store hashed code in phone_identities table
          // For now, simplified implementation
          
          // Send code via SMS
          if (phoneConfig.sendCode) {
            await phoneConfig.sendCode(identity.subject_id, code, phone, 'verification');
          }
          
          return {
            success: false,
            message: 'Phone verification required. Code sent to your phone.',
            subject: identity.subject_id,
            others,
          };
        }
      }

      // Create session
      const session = await sessionService.createSession(
        identity.subject_id,
        phoneConfig.sessionTtlSeconds || 3600,
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