import { RootStepHooks } from '../../types';

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
  rootHooks?: RootStepHooks<EmailPasswordConfig>;
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
