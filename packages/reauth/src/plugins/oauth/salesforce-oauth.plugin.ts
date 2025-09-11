import * as arctic from 'arctic';
import {
  createOAuthPlugin,
  BaseOAuthConfig,
} from './utils/oauth-plugin-factory';

/**
 * Salesforce OAuth configuration
 */
export interface SalesforceOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional Salesforce-specific scopes (optional)
   * Default scopes: 'id', 'api'
   */
  scopes?: string[];
  /**
   * Salesforce instance domain (default: login.salesforce.com)
   * For sandbox environments use: test.salesforce.com
   * For custom domains use: your-domain.my.salesforce.com
   */
  domain?: string;
}

/**
 * Create Salesforce OAuth plugin
 * Supports Salesforce OAuth with CRM access and custom domains
 */
export const salesforceOAuthPlugin = createOAuthPlugin<SalesforceOAuthConfig>(
  'Salesforce',
  'regular',
  (config: SalesforceOAuthConfig) =>
    new arctic.Salesforce(
      config.clientId,
      config.clientSecret,
      config.redirectUri,
      config.domain || 'login.salesforce.com',
    ),
  ['id', 'api'], // Default scopes
);

export default salesforceOAuthPlugin;

// Export schema for validation
export const salesforceOAuthSchema = {
  clientId: 'string',
  clientSecret: 'string',
  redirectUri: 'string',
  scopes: 'string[]?',
  domain: 'string?',
} as const;