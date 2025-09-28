import type { EmailPasswordConfig } from '../email-password/types';
import type { UsernamePasswordConfig } from '../username/types';

export type EmailOrUsernameConfig = {
  /**
   * Configuration for the underlying email-password plugin
   */
  emailConfig?: Partial<EmailPasswordConfig>;

  /**
   * Configuration for the underlying username plugin
   */
  usernameConfig?: Partial<UsernamePasswordConfig>;

  /**
   * Strategy for detecting input type
   * - 'auto': Automatically detect email vs username based on format
   * - 'explicit': Require explicit type indication (future enhancement)
   */
  detectionStrategy?: 'auto' | 'explicit';

  /**
   * Whether users can have both email and username identities
   * Currently not implemented - delegated to underlying plugins
   */
  allowBothTypes?: boolean;

  /**
   * Preferred type for ambiguous cases (future enhancement)
   */
  preferredType?: 'email' | 'username';

  /**
   * Session TTL in seconds (applies to both underlying plugins)
   */
  sessionTtlSeconds?: number;

  /**
   * Whether to login user immediately after registration
   */
  loginOnRegister?: boolean;

  /**
   * Test users configuration supporting both email and username
   */
  testUsers?: {
    enabled: boolean;
    users: Array<{
      email?: string;
      username?: string;
      password: string;
      profile: Record<string, any>;
    }>;
    environment: string;
    checkEnvironment: (environment: string) => boolean;
  };
};
