import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  type Token,
  tokenType,
} from '../../../types';
import type { PasswordlessConfig } from '../types';
import { isValidCredentialId, generateCredentialName } from '../utils';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export type RegisterWebAuthnInput = {
  token: Token;
  credential_id: string;
  public_key: string;
  counter?: number;
  transports?: string[];
  name?: string;
  others?: Record<string, any>;
};

export const registerWebAuthnValidation = type({
  token: tokenType,
  credential_id: 'string',
  public_key: 'string',
  counter: 'number?',
  transports: 'string[]?',
  name: 'string?',
  'others?': 'object | undefined',
});

export const registerWebAuthnStep: AuthStep<
  PasswordlessConfig,
  RegisterWebAuthnInput,
  AuthOutput
> = {
  name: 'register-webauthn',
  description:
    'Register a new WebAuthn credential for passwordless authentication',
  validationSchema: registerWebAuthnValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 201, ic: 400, nf: 404, cf: 409 },
      auth: true,
    },
  },
  inputs: [
    'token',
    'credential_id',
    'public_key',
    'counter',
    'transports',
    'name',
    'others',
  ],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'credential?': type({
      id: 'string',
      name: 'string',
      created_at: 'string',
      transports: 'string[]',
    }),
    'others?': 'object | undefined',
    'token?': tokenType,
  }),
  async run(input, ctx) {
    const {
      token,
      credential_id,
      public_key,
      counter = 0,
      transports,
      name,
      others,
    } = input;
    const orm = await ctx.engine.getOrm();

    const t = await ctx.engine.checkSession(token);
    if (!t || !t.subject || !t.subject.id) {
      return {
        success: false,
        message: 'Invalid or expired session token',
        status: 'ic',
        error: 'Authentication required',
      };
    }
    // Validate config requires WebAuthn
    if (!ctx.config?.webauthn) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'WebAuthn authentication is not configured',
          status: 'ic',
          error: 'WebAuthn authentication is not enabled',
        },
        token,
        t.token,
      );
    }

    try {
      // Validate credential ID format
      if (!isValidCredentialId(credential_id)) {
        return attachNewTokenIfDifferent(
          {
            success: false,
            message: 'Invalid credential ID format',
            status: 'ic',
          },
          token,
          t.token,
        );
      }

      // Check if subject exists
      const subject = await orm.findFirst('subjects', {
        where: (b: any) => b('id', '=', t.subject.id),
      });

      if (!subject) {
        return attachNewTokenIfDifferent(
          {
            success: false,
            message: 'Subject not found',
            status: 'nf',
          },
          token,
          t.token,
        );
      }

      // Check if credential already exists
      const existingCredential = await orm.findFirst('webauthn_credentials', {
        where: (b: any) => b('credential_id', '=', credential_id),
      });

      if (existingCredential) {
        return attachNewTokenIfDifferent(
          {
            success: false,
            message: 'Credential already registered',
            status: 'cf',
          },
          token,
          t.token,
        );
      }

      // Create credential name if not provided
      const credentialName = name || generateCredentialName();

      // Register the credential
      const credential = await orm.create('webauthn_credentials', {
        subject_id: t.subject.id,
        credential_id,
        public_key,
        counter: BigInt(counter),
        transports: transports || null,
        name: credentialName,
        is_active: true,
        last_used_at: null,
      });

      return attachNewTokenIfDifferent(
        {
          success: true,
          message: 'WebAuthn credential registered successfully',
          status: 'su',
          credential: {
            id: credential.id,
            name: credential.name,
            created_at: credential.created_at,
            transports: credential.transports,
          },
          others: {
            subject_id: t.subject.id,
            credential_id,
            authentication_method: 'webauthn_registration',
            ...others,
          },
        },
        token,
        t.token,
      );
    } catch (error) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Failed to register WebAuthn credential',
          status: 'ic',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        token,
        t.token,
      );
    }
  },
};
