import { type } from 'arktype';
import type { AuthStepV2, AuthInputV2, AuthOutputV2, StepContextV2 } from '../../../types.v2';
import type { PhoneConfigV2 } from '../types';
import { hashPassword, verifyPasswordHash, haveIbeenPawned } from '../../../../lib/password';
import { passwordSchema } from '../../../../plugins/shared/validation';

// Input schema
const changePasswordInputSchema = type({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
  others: 'object?',
});

// Output schema
const changePasswordOutputSchema = type({
  success: 'boolean',
  message: 'string?',
  others: 'object?',
});

interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  others?: Record<string, any>;
}

interface ChangePasswordOutput {
  success: boolean;
  message?: string;
  others?: Record<string, any>;
}

export const changePasswordStep: AuthStepV2<ChangePasswordInput, ChangePasswordOutput> = {
  name: 'change-password',
  description: 'Change user password (requires authentication)',
  inputs: changePasswordInputSchema,
  outputs: changePasswordOutputSchema,
  protocol: {
    method: 'POST',
    path: '/phone/change-password',
    auth: true,
    statusCodes: {
      success: 200,
      error: 400,
      validation: 400,
    },
  },

  async run(input: ChangePasswordInput, context: StepContextV2): Promise<ChangePasswordOutput> {
    const { currentPassword, newPassword, others } = input;
    const { container, config } = context;
    const phoneConfig = config as PhoneConfigV2;
    const entityService = container.cradle.entityService;
    const sessionService = container.cradle.sessionService;

    try {
      // TODO: Extract subject_id from authentication context
      // For now, this is a placeholder - in production, get from session/token
      // const session = await getSessionFromContext(context);
      // const subject_id = session.subject_id;
      
      // Placeholder for demonstration
      const subject_id = 'placeholder-subject-id';

      // Get current credentials
      const credentials = await entityService.getCredentials(subject_id);
      
      if (!credentials) {
        return {
          success: false,
          message: 'User credentials not found',
          others,
        };
      }

      // Verify current password
      const currentPasswordValid = await verifyPasswordHash(credentials.password_hash, currentPassword);
      
      if (!currentPasswordValid) {
        return {
          success: false,
          message: 'Current password is incorrect',
          others,
        };
      }

      // Password safety check using HaveIBeenPwned
      const passwordSafe = await haveIbeenPawned(newPassword);
      if (!passwordSafe) {
        return {
          success: false,
          message: 'Password has been compromised. Please choose a different password.',
          others,
        };
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword);

      // Update credentials
      await entityService.setCredentials(subject_id, newPasswordHash);

      return {
        success: true,
        message: 'Password changed successfully',
        others,
      };

    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Password change failed',
        others,
      };
    }
  },
};