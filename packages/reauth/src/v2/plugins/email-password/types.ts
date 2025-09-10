export type EmailPasswordConfigV2 = {
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
