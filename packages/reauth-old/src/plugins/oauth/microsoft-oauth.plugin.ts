import * as arctic from 'arctic';
import {
  createOAuthPlugin,
  BaseOAuthConfig,
} from './utils/oauth-plugin-factory';
import { column } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../types';

/**
 * Microsoft OAuth configuration
 */
export interface MicrosoftOAuthConfig extends BaseOAuthConfig {
  /**
   * Microsoft tenant ID (default: 'common' for multi-tenant)
   */
  tenantId?: string;
  /**
   * Additional Microsoft-specific scopes (optional)
   * Default scopes: 'openid', 'profile', 'email', 'User.Read'
   */
  scopes?: string[];
}

/**
 * Create Microsoft OAuth plugin
 * Microsoft uses PKCE flow
 */
export const microsoftOAuthPlugin = createOAuthPlugin<MicrosoftOAuthConfig>(
  'Microsoft',
  'pkce', // Microsoft Entra ID uses PKCE
  (config: MicrosoftOAuthConfig) =>
    new arctic.MicrosoftEntraId(
      config.tenantId || 'common',
      config.clientId,
      config.clientSecret,
      config.redirectUri,
    ),
  ['openid', 'profile', 'email', 'User.Read'], // Default scopes
);

export default microsoftOAuthPlugin;

export const microsoftOAuthSchema: ReauthSchemaPlugin = {
  extendTables: {
    entities: {
      microsoft_id: column('microsoft_id', 'varchar(255)').nullable().unique(),
      microsoft_data: column('microsoft_data', 'json').nullable(),
    },
  },
};
