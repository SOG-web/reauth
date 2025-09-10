export type PhonePasswordConfigV2 = {
  loginOnRegister?: boolean; // default true
  sessionTtlSeconds?: number; // default 3600
  codeType?: 'numeric' | 'alphanumeric' | 'alphabet';
  codeLength?: number; // V2 correct spelling (not V1's "codeLenght")
  generateCode?: (phone: string, subject?: any) => Promise<string | number>;
  verificationCodeExpiresIn?: number; // ms
  resetPasswordCodeExpiresIn?: number; // ms
  testUsers?: {
    enabled: boolean;
    users: Array<{
      phone: string;
      password: string;
      profile: Record<string, any>;
    }>;
    environment?: 'development' | 'test' | 'all';
  };
} & (
  | {
      verifyPhone: true;
      sendCode: (
        subject: any,
        code: string | number,
        phone: string,
        type: 'verify' | 'reset',
      ) => Promise<void>;
    }
  | {
      verifyPhone?: false;
      sendCode?: (
        subject: any,
        code: string | number,
        phone: string,
        type: 'verify' | 'reset',
      ) => Promise<void>;
    }
);