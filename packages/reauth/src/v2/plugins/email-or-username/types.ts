import type { EmailPasswordConfigV2 } from '../email-password/types';
import type { UsernamePasswordConfigV2 } from '../username/types';

export type EmailOrUsernameConfigV2 = {
  /**
   * Configuration for the underlying email-password plugin
   */
  emailConfig?: Partial<EmailPasswordConfigV2>;
  
  /**
   * Configuration for the underlying username plugin
   */
  usernameConfig?: Partial<UsernamePasswordConfigV2>;
  
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
    environment?: 'development' | 'test' | 'all';
  };
};