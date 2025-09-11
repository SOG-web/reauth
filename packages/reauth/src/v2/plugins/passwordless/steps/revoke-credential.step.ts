import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { PasswordlessConfigV2 } from '../types';

export type RevokeCredentialInput = {
  token: string;
  credential_id: string;
  others?: Record<string, any>;
};

export const revokeCredentialValidation = type({
  token: 'string',
  credential_id: 'string',
  others: 'object?',
});

export const revokeCredentialStep: AuthStepV2<
  RevokeCredentialInput,
  AuthOutput,
  PasswordlessConfigV2
> = {
  name: 'revoke-credential',
  description: 'Deactivate a passwordless credential',
  validationSchema: revokeCredentialValidation,
  protocol: {
    http: {
      method: 'DELETE',
      codes: { su: 200, ic: 400, nf: 404, fo: 403 },
      auth: true,
    },
  },
  inputs: ['token', 'credential_id', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { token, credential_id, others } = input;
    const orm = await ctx.engine.getOrm();

    // Validate session first; return explicit 403/401 on failure.
    let t: any;
    try {
      t = await ctx.engine.checkSession(token);
    } catch {
      return {
        success: false,
        message: 'Invalid or expired session token',
        status: 'fo',
      };
    }

    try {
      // Check if subject exists
      const subject = await orm.findFirst('subjects', {
        where: (b: any) => b('id', '=', t.subject.id),
      });

      if (!subject) {
        return {
          success: false,
          message: 'Subject not found',
          status: 'nf',
        };
      }

      // Find the credential
      const credential = await orm.findFirst('webauthn_credentials', {
        where: (b: any) => b('id', '=', credential_id),
      });

      if (!credential) {
        return {
          success: false,
          message: 'Credential not found',
          status: 'nf',
        };
      }

      // Verify ownership
      if (credential.subject_id !== t.subject.id) {
        return {
          success: false,
          message: 'Credential does not belong to this subject',
          status: 'fo',
        };
      }

      // Check if already inactive
      if (!credential.is_active) {
        return {
          success: false,
          message: 'Credential is already inactive',
          status: 'ic',
        };
      }

      // Deactivate the credential (soft delete)
      await (orm as any).updateMany('webauthn_credentials', {
        where: (b: any) => b('id', '=', credential.id),
        set: { is_active: false },
      });

      return {
        success: true,
        message: 'Credential revoked successfully',
        status: 'su',
        others: {
          credential_id,
          credential_name: credential.name,
          revoked_at: new Date().toISOString(),
          ...others,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to revoke credential',
        status: 'ic',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};
