import { RootStepHooks } from '../../types';
import { SendMagicLinkInput } from './steps/send-magic-link.step';

export type PasswordlessConfig = {
  sessionTtlSeconds?: number; // default 3600
  magicLinkTtlMinutes?: number; // default 30
  verificationCodeTtlMinutes?: number; // default 10
  verificationCodeLength?: number; // default 6
  verificationCodeType?: 'numeric' | 'alphanumeric'; // default 'numeric'
  maxVerificationAttempts?: number; // default 3
  // Cleanup configuration
  cleanupIntervalMinutes?: number; // default 60 (1 hour)

  useEmailPlugin: boolean;
  getEmail?: (input: SendMagicLinkInput) => Promise<string>;

  /**
   * Root hooks
   * @example
   * rootHooks: {
   *  before: async (input, pluginProperties) => {
   *    // do something before the plugin runs
   *  }
   */
  rootHooks?: RootStepHooks<PasswordlessConfig>;
} & (
  | {
      // Magic links enabled
      magicLinks: true;
      sendMagicLink: (
        email: string,
        token: string,
        subject: any,
      ) => Promise<void>;
      webauthn?: false;
      verificationCodes?: false;
    }
  | {
      // WebAuthn enabled
      webauthn: true;
      rpId: string; // Relying Party ID (domain)
      rpName: string; // Relying Party Name
      magicLinks?: false;
      verificationCodes?: false;
    }
  | {
      // Verification codes enabled
      verificationCodes: true;
      sendCode: (
        destination: string,
        code: string,
        destinationType: 'phone' | 'email' | 'whatsapp',
        purpose: 'login' | 'register' | 'verify',
        subject: any,
      ) => Promise<void>;
      magicLinks?: false;
      webauthn?: false;
    }
  | {
      // Magic links + WebAuthn enabled
      magicLinks: true;
      sendMagicLink: (
        email: string,
        token: string,
        subject: any,
      ) => Promise<void>;
      webauthn: true;
      rpId: string;
      rpName: string;
      verificationCodes?: false;
    }
  | {
      // Magic links + Verification codes enabled
      magicLinks: true;
      sendMagicLink: (
        email: string,
        token: string,
        subject: any,
      ) => Promise<void>;
      verificationCodes: true;
      sendCode: (
        destination: string,
        code: string,
        destinationType: 'phone' | 'email' | 'whatsapp',
        purpose: 'login' | 'register' | 'verify',
        subject: any,
      ) => Promise<void>;
      webauthn?: false;
    }
  | {
      // WebAuthn + Verification codes enabled
      webauthn: true;
      rpId: string;
      rpName: string;
      verificationCodes: true;
      sendCode: (
        destination: string,
        code: string,
        destinationType: 'phone' | 'email' | 'whatsapp',
        purpose: 'login' | 'register' | 'verify',
        subject: any,
      ) => Promise<void>;
      magicLinks?: false;
    }
  | {
      // All three enabled
      magicLinks: true;
      sendMagicLink: (
        email: string,
        token: string,
        subject: any,
      ) => Promise<void>;
      webauthn: true;
      rpId: string;
      rpName: string;
      verificationCodes: true;
      sendCode: (
        destination: string,
        code: string,
        destinationType: 'phone' | 'email' | 'whatsapp',
        purpose: 'login' | 'register' | 'verify',
        subject: any,
      ) => Promise<void>;
    }
  | {
      // At least one must be enabled
      magicLinks?: false;
      webauthn?: false;
      verificationCodes?: false;
      // This combination should be invalid, will be caught by validation
    }
);

export type MagicLinkRecord = {
  id: string;
  subject_id: string;
  token_hash: string;
  email: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
  metadata: any;
};

export type WebAuthnCredentialRecord = {
  id: string;
  subject_id: string;
  credential_id: string;
  public_key: string;
  counter: bigint;
  transports: string[] | null;
  created_at: Date;
  last_used_at: Date | null;
  name: string | null;
  is_active: boolean;
};

export type VerificationCodeRecord = {
  id: string;
  subject_id: string | null;
  code_hash: string;
  destination: string;
  destination_type: 'phone' | 'email' | 'whatsapp';
  purpose: 'login' | 'register' | 'verify';
  expires_at: Date;
  used_at: Date | null;
  attempts: number;
  max_attempts: number;
  created_at: Date;
  metadata: any;
};
