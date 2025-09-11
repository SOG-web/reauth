import type { EmailOrUsernameConfigV2 } from './types';

/**
 * Email validation regex - matches standard email format
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Detect whether input is an email or username
 */
export function detectInputType(emailOrUsername: string): 'email' | 'username' {
  return EMAIL_REGEX.test(emailOrUsername) ? 'email' : 'username';
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/**
 * Find test user from configuration, supporting both email and username
 */
export function findTestUser(
  emailOrUsername: string,
  password: string,
  config: EmailOrUsernameConfigV2,
): {
  email?: string;
  username?: string;
  password: string;
  profile: Record<string, any>;
} | null {
  if (!config.testUsers?.enabled) return null;

  const env = process.env.NODE_ENV || 'development';
  const allowedEnv = config.testUsers.environment || 'development';

  if (allowedEnv !== 'all' && env !== allowedEnv) return null;

  const inputType = detectInputType(emailOrUsername);

  return (
    config.testUsers.users.find((user) => {
      if (user.password !== password) return false;

      if (inputType === 'email' && user.email === emailOrUsername) return true;
      if (inputType === 'username' && user.username === emailOrUsername)
        return true;

      return false;
    }) || null
  );
}

/**
 * Create configuration for email-password plugin from composite config
 */
export function createEmailConfig(config: EmailOrUsernameConfigV2) {
  return {
    ...config.emailConfig,
    sessionTtlSeconds:
      config.sessionTtlSeconds ?? config.emailConfig?.sessionTtlSeconds,
    loginOnRegister:
      config.loginOnRegister ?? config.emailConfig?.loginOnRegister,
    testUsers: config.testUsers?.enabled
      ? {
          enabled: true,
          users: config.testUsers.users
            .filter((user) => user.email)
            .map((user) => ({
              email: user.email!,
              password: user.password,
              profile: user.profile,
            })),
          environment: config.testUsers.environment,
        }
      : undefined,
  };
}

/**
 * Create configuration for username plugin from composite config
 */
export function createUsernameConfig(config: EmailOrUsernameConfigV2) {
  return {
    ...config.usernameConfig,
    sessionTtlSeconds:
      config.sessionTtlSeconds ?? config.usernameConfig?.sessionTtlSeconds,
    loginOnRegister:
      config.loginOnRegister ?? config.usernameConfig?.loginOnRegister,
    testUsers: config.testUsers?.enabled
      ? {
          enabled: true,
          users: config.testUsers.users
            .filter((user) => user.username)
            .map((user) => ({
              username: user.username!,
              password: user.password,
              profile: user.profile,
            })),
          environment: config.testUsers.environment,
        }
      : undefined,
  };
}

/**
 * Transform email input to work with email-password plugin
 */
export function transformToEmailInput(
  emailOrUsername: string,
  password: string,
  others?: Record<string, any>,
) {
  return {
    email: emailOrUsername,
    password,
    others,
  };
}

/**
 * Transform username input to work with username plugin
 */
export function transformToUsernameInput(
  emailOrUsername: string,
  password: string,
  others?: Record<string, any>,
) {
  return {
    username: emailOrUsername,
    password,
    others,
  };
}

/**
 * Transform plugin output to maintain consistent format
 */
export function transformPluginOutput(
  output: any,
  inputType: 'email' | 'username',
  originalInput: string,
) {
  return {
    ...output,
    subject: output.subject
      ? {
          ...output.subject,
          // Ensure the original input is preserved in subject
          [inputType]: originalInput,
        }
      : output.subject,
  };
}
