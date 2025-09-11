export type PasswordlessConfigV2 = {
  sessionTtlSeconds?: number; // default 3600
  magicLinkTtlMinutes?: number; // default 30
  // Cleanup configuration
  cleanupEnabled?: boolean; // default true
  cleanupIntervalMinutes?: number; // default 60 (1 hour)
  retentionDays?: number; // how long to keep expired magic links (default 1 day)
  cleanupBatchSize?: number; // process in batches (default 100)
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
    }
  | {
      // WebAuthn enabled
      webauthn: true;
      rpId: string; // Relying Party ID (domain)
      rpName: string; // Relying Party Name
      magicLinks?: false;
    }
  | {
      // Both enabled
      magicLinks: true;
      sendMagicLink: (
        email: string,
        token: string,
        subject: any,
      ) => Promise<void>;
      webauthn: true;
      rpId: string;
      rpName: string;
    }
  | {
      // At least one must be enabled
      magicLinks?: false;
      webauthn?: false;
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