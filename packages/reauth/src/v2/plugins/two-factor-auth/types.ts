export interface TwoFactorAuthConfigV2 {
  // TOTP Configuration
  totp?: {
    enabled: boolean;
    issuer: string;
    algorithm: 'SHA1' | 'SHA256' | 'SHA512';
    digits: 6 | 8;
    period: number; // seconds
    window: number; // tolerance window
  };

  // SMS Configuration
  sms?: {
    enabled: boolean;
    sendCode: (phone: string, code: string, userId: string) => Promise<void>;
    codeLength: number;
    expiryMinutes: number;
    rateLimit: {
      maxAttempts: number;
      windowMinutes: number;
    };
  };

  // Email Configuration
  email?: {
    enabled: boolean;
    codeLength: number;
    expiryMinutes: number;
    sendCode: (email: string, code: string, userId: string) => Promise<void>;
  };

  // Backup Codes
  backupCodes?: {
    enabled: boolean;
    count: number;
    length: number;
  };

  // Hardware Tokens
  hardwareTokens?: {
    enabled: boolean;
    allowedCredentialTypes: string[];
  };

  // Security Settings
  security: {
    requireForLogin: boolean;
    requireForSensitiveActions: boolean;
    maxFailedAttempts: number;
    lockoutDurationMinutes: number;
  };

  // Cleanup Configuration
  cleanup?: {
    enabled: boolean;
    intervalMinutes: number;
    expiredCodeRetentionHours: number;
    failedAttemptRetentionDays: number;
  };

  // Session settings
  sessionTtlSeconds?: number;
}

export interface TwoFactorMethod {
  id: string;
  userId: string;
  methodType: 'totp' | 'sms' | 'email' | 'hardware';
  secretEncrypted?: string;
  phoneNumberEncrypted?: string;
  emailEncrypted?: string;
  isPrimary: boolean;
  isVerified: boolean;
  createdAt: Date;
  verifiedAt?: Date;
  lastUsedAt?: Date;
}

export interface TwoFactorCode {
  id: string;
  userId: string;
  methodId?: string;
  codeHash: string;
  methodType: 'totp' | 'sms' | 'email' | 'backup';
  expiresAt: Date;
  usedAt?: Date;
  attempts: number;
  createdAt: Date;
}

export interface TwoFactorBackupCode {
  id: string;
  userId: string;
  codeHash: string;
  usedAt?: Date;
  createdAt: Date;
}

export interface TwoFactorHardwareToken {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  name?: string;
  createdAt: Date;
  lastUsedAt?: Date;
}

export interface TwoFactorFailedAttempt {
  id: string;
  userId: string;
  methodType: 'totp' | 'sms' | 'email' | 'backup' | 'hardware';
  ipAddress?: string;
  userAgent?: string;
  attemptedAt: Date;
}

// Step input/output types
export interface SetupTotpInput {
  userId: string;
  issuer?: string;
  accountName?: string;
}

export interface SetupTotpOutput {
  secret: string;
  qrCodeUrl: string;
  backupCodes?: string[];
}

export interface Verify2faInput {
  userId: string;
  code: string;
  methodType: 'totp' | 'sms' | 'email' | 'backup';
  methodId?: string;
}

export interface Verify2faOutput {
  verified: boolean;
  remainingBackupCodes?: number;
  nextRequiredAction?: string;
}

export interface Setup2faInput {
  userId: string;
  methodType: 'totp' | 'sms' | 'email';
  phone?: string;
  email?: string;
  issuer?: string;
  accountName?: string;
}

export interface Setup2faOutput {
  success: boolean;
  message: string;
  methodId?: string;
  secret?: string;
  qrCodeUrl?: string;
  verificationRequired?: boolean;
}

export interface GenerateBackupCodesInput {
  userId: string;
  regenerate?: boolean;
}

export interface GenerateBackupCodesOutput {
  backupCodes: string[];
  count: number;
}

export interface ListMethodsInput {
  userId: string;
}

export interface ListMethodsOutput {
  methods: Array<{
    id: string;
    methodType: string;
    isPrimary: boolean;
    isVerified: boolean;
    lastUsedAt?: Date;
    maskedIdentifier?: string; // masked phone/email
  }>;
}