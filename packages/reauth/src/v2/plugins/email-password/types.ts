import type { Entity } from '../../../types';

export interface EmailPasswordConfigV2 {
  verifyEmail?: boolean; // default false
  loginOnRegister?: boolean; // default true
  sessionTtlSeconds?: number; // default 3600
  codeType?: 'numeric' | 'alphanumeric' | 'alphabet';
  codeLenght?: number; // keep V1 spelling
  generateCode?: (email: string, subject?: any) => Promise<string | number>;
  sendCode?: (
    subject: any,
    code: string | number,
    email: string,
    type: 'verify' | 'reset',
  ) => Promise<void>;
  resetPasswordCodeExpiresIn?: number; // ms
  testUsers?: {
    enabled: boolean;
    users: Array<{ email: string; password: string; profile: Record<string, any> }>;
    environment?: 'development' | 'test' | 'all';
  };
}
