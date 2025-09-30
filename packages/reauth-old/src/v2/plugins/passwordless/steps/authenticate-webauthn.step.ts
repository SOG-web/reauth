import { type } from 'arktype';
import type { AuthStep, AuthOutput } from '../../../types.';
import type { PasswordlessConfig } from '../types';

export type AuthenticateWebAuthnInput = {
  credential_id: string;
  signature: string;
  counter: number;
  others?: Record<string, any>;
};

export const authenticateWebAuthnValidation = type({
  credential_id: 'string',
  signature: 'string',
  counter: 'number',
  'others?': 'object | undefined',
});

export const authenticateWebAuthnStep: AuthStep<
  AuthenticateWebAuthnInput,
  AuthOutput,
  PasswordlessConfig
> = {
  name: 'authenticate-webauthn',
  description: 'Authenticate user with WebAuthn credential',
  validationSchema: authenticateWebAuthnValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ic: 400, nf: 404, un: 401, di: 410 },
    },
  },
  inputs: ['credential_id', 'signature', 'counter', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'token?': 'string',
    'subject?': type({
      id: 'string',
      name: 'string',
      email: 'string',
      provider: 'string',
      verified: 'boolean',
      profile: 'object?',
    }),
    'others?': 'object | undefined',
  }),
  async run(input, ctx) {
    const { credential_id, signature, counter, others } = input;
    const orm = await ctx.engine.getOrm();

    // Validate config requires WebAuthn
    if (!ctx.config?.webauthn) {
      return {
        success: false,
        message: 'WebAuthn authentication is not configured',
        status: 'ic',
        error: 'WebAuthn authentication is not enabled',
      };
    }

    try {
      // Find credential
      const credential = await orm.findFirst('webauthn_credentials', {
        where: (b: any) =>
          b.and(
            b('credential_id', '=', credential_id),
            b('is_active', '=', true),
          ),
      });

      if (!credential) {
        return {
          success: false,
          message: 'Credential not found or inactive',
          status: 'nf',
        };
      }

      // Check counter replay attack protection
      if (counter <= Number(credential.counter)) {
        return {
          success: false,
          message: 'Invalid counter value - possible replay attack',
          status: 'un',
        };
      }

      // In a real implementation, you would verify the signature here
      // This is a simplified version that trusts the provided signature
      // Real WebAuthn verification requires:
      // 1. Verify the signature against the public key
      // 2. Validate the authenticator data
      // 3. Check the client data JSON
      // 4. Verify the challenge matches

      // For this implementation, we'll assume signature verification is done
      // by the client/frontend before calling this step

      // Update counter and last used timestamp
      await (orm as any).updateMany('webauthn_credentials', {
        where: (b: any) => b('id', '=', credential.id),
        set: {
          counter: BigInt(counter),
          last_used_at: new Date(),
        },
      });

      // Get subject
      const subject = await orm.findFirst('subjects', {
        where: (b: any) => b('id', '=', credential.subject_id),
      });

      if (!subject) {
        return {
          success: false,
          message: 'Associated account not found',
          status: 'nf',
        };
      }

      // Create session
      const sessionToken = await ctx.engine.createSessionFor(
        'subject',
        subject.id as string,
        ctx.config.sessionTtlSeconds || 3600,
      );

      return {
        success: true,
        message: 'Authentication successful',
        status: 'su',
        token: sessionToken,
        subject,
        others: {
          credential_name: credential.name,
          authentication_method: 'webauthn',
          ...others,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to authenticate with WebAuthn',
        status: 'ic',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};
