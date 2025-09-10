import { type } from 'arktype';
import type { AuthStepV2, AuthInputV2, AuthOutputV2, StepContextV2 } from '../../../types.v2';
import type { PhoneConfigV2 } from '../types';
import { hashPassword } from '../../../../lib/password';
import { haveIbeenPawned } from '../../../../lib/password';
import { phoneSchema } from '../../../../plugins/shared/validation';
import { passwordSchema } from '../../../../plugins/shared/validation';
import { findTestUser, isTestEnvironmentAllowed, genCode, generateId } from '../utils';

// Input schema
const registerInputSchema = type({
  phone: phoneSchema,
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
  phone: string;
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
  description: 'Register new user with phone and password',
  inputs: registerInputSchema,
  outputs: registerOutputSchema,
  protocol: {
    method: 'POST',
    path: '/phone/register',
    auth: false,
    statusCodes: {
      success: 201,
      error: 400,
      validation: 400,
    },
  },

  async run(input: RegisterInput, context: StepContextV2): Promise<RegisterOutput> {
    const { phone, password, others } = input;
    const { container, config } = context;
    const phoneConfig = config as PhoneConfigV2;
    const entityService = container.cradle.entityService;
    const sessionService = container.cradle.sessionService;

    try {
      // Check if phone already exists
      const existingIdentity = await entityService.findIdentity('phone', phone);
      
      if (existingIdentity) {
        return {
          success: false,
          message: 'Phone number already registered',
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

      // Check if test user and environment allows
      const isTestUser = findTestUser(phone, phoneConfig.testUsers || { enabled: false, environmentGating: false, users: [] });
      const testEnvAllowed = isTestEnvironmentAllowed(phoneConfig.testUsers || { enabled: false, environmentGating: false, users: [] });

      // Create identity - verified status depends on verification settings and test user status
      const verified = !phoneConfig.verifyPhone || (isTestUser && testEnvAllowed);
      
      const identity = await entityService.createIdentity({
        subject_id: subject.id,
        provider: 'phone',
        identifier: phone,
        verified,
      });

      // If verification required and not auto-verified (test user)
      if (phoneConfig.verifyPhone && !verified) {
        // Generate verification code and store hashed
        const code = genCode(phoneConfig.codeLength || 6);
        const hashedCode = await hashPassword(code);
        const expiresAt = new Date(Date.now() + (phoneConfig.verificationCodeExpiresIn || 900) * 1000);
        
        // TODO: Store hashed code in phone_identities table
        // For now, simplified implementation
        
        // Send code via SMS
        if (phoneConfig.sendCode) {
          await phoneConfig.sendCode(subject.id, code, phone, 'verification');
        }
        
        return {
          success: true,
          message: 'Registration successful. Please verify your phone number.',
          subject: subject.id,
          others,
        };
      }

      // Create session if loginOnRegister is enabled
      let session;
      if (phoneConfig.loginOnRegister) {
        session = await sessionService.createSession(
          subject.id,
          phoneConfig.sessionTtlSeconds || 3600,
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