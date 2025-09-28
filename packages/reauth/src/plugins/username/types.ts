export type UsernamePasswordConfig = {
  loginOnRegister?: boolean; // default true
  sessionTtlSeconds?: number; // default 3600
  testUsers?: {
    enabled: boolean;
    users: Array<{
      username: string;
      password: string;
      profile: Record<string, any>;
    }>;
    environment: string;
    checkEnvironment: (environment: string) => boolean;
  };
  // Note: Username has NO verification per product decision
  // Optional: Add reset by username if needed in the future
  enableResetByUsername?: boolean;
  resetPasswordCodeExpiresIn?: number; // ms (only if enableResetByUsername is true)
  codeType?: 'numeric' | 'alphanumeric' | 'alphabet';
  codeLength?: number;
  generateCode?: (username: string, subject?: any) => Promise<string | number>;
  sendCode?: (
    subject: any,
    code: string | number,
    username: string,
    type: 'reset',
  ) => Promise<void>;
  // Cleanup configuration
  cleanupIntervalMinutes?: number; // default 60 (1 hour)
};
