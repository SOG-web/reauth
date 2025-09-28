export type EmailPasswordConfig = {
  loginOnRegister?: boolean; // default true
  sessionTtlSeconds?: number; // default 3600
  codeType?: 'numeric' | 'alphanumeric' | 'alphabet';
  codeLength?: number; // keep V1 spelling
  generateCode?: (email: string, subject?: any) => Promise<string | number>;
  verificationCodeExpiresIn?: number; // ms
  resetPasswordCodeExpiresIn?: number; // ms
  testUsers?: {
    enabled: boolean;
    users: Array<{
      email: string;
      password: string;
      profile: Record<string, any>;
    }>;
    environment?: 'development' | 'test' | 'all';
  };
  // Cleanup configuration
  cleanupEnabled?: boolean; // default true
  cleanupIntervalMinutes?: number; // default 60 (1 hour)
  retentionDays?: number; // how long to keep expired codes (default 1 day)
  cleanupBatchSize?: number; // process in batches (default 100)
} & (
  | {
      verifyEmail: true;
      sendCode: (
        subject: any,
        code: string | number,
        email: string,
        type: 'verify' | 'reset',
      ) => Promise<void>;
    }
  | {
      verifyEmail?: false;
      sendCode?: (
        subject: any,
        code: string | number,
        email: string,
        type: 'verify' | 'reset',
      ) => Promise<void>;
    }
);
