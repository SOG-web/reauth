import { RootStepHooks } from '../../types';

export type PhonePasswordConfig = {
  loginOnRegister?: boolean; // default true
  sessionTtlSeconds?: number; // default 3600
  codeType?: 'numeric' | 'alphanumeric' | 'alphabet';
  codeLength?: number; //  correct spelling (not V1's "codeLenght")
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
    environment: string;
    checkEnvironment: (environment: string) => boolean;
  };

  cleanupIntervalMinutes?: number; // default 60 (1 hour)

  /**
   * Root hooks
   * @example
   * rootHooks: {
   *  before: async (input, pluginProperties) => {
   *    // do something before the plugin runs
   *  }
   */
  rootHooks?: RootStepHooks<PhonePasswordConfig>;
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
