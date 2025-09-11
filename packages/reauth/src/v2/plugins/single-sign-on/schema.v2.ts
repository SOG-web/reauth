import { column, idColumn, table } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../../types';

// Identity Providers Table
export const ssoIdentityProviders = table('sso_identity_providers', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  name: column('name', 'varchar(255)'),
  type: column('type', 'varchar(50)'), // 'saml', 'oidc', 'ws-federation', 'cas'
  entity_id: column('entity_id', 'varchar(500)'),
  configuration: column('configuration', 'json'),
  attribute_mapping: column('attribute_mapping', 'json'),
  security_config: column('security_config', 'json'),
  is_active: column('is_active', 'bool').defaultTo$(true),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
}).unique('sso_provider_name_uk', ['name']);

// SSO Sessions Table
export const ssoSessions = table('sso_sessions', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  user_id: column('user_id', 'varchar(255)'),
  provider_id: column('provider_id', 'varchar(255)'),
  session_index: column('session_index', 'varchar(255)').nullable(),
  name_id: column('name_id', 'varchar(255)'),
  name_id_format: column('name_id_format', 'varchar(100)'),
  assertion_id: column('assertion_id', 'varchar(255)').nullable(),
  federated_session_id: column('federated_session_id', 'varchar(255)').nullable(),
  attributes: column('attributes', 'json'),
  auth_instant: column('auth_instant', 'timestamp'),
  expires_at: column('expires_at', 'timestamp'),
  logout_initiated: column('logout_initiated', 'bool').defaultTo$(false),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
});

// SAML Assertions Table
export const ssoSamlAssertions = table('sso_saml_assertions', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  assertion_id: column('assertion_id', 'varchar(255)'),
  provider_id: column('provider_id', 'varchar(255)'),
  user_id: column('user_id', 'varchar(255)'),
  name_id: column('name_id', 'varchar(255)'),
  session_index: column('session_index', 'varchar(255)').nullable(),
  assertion_xml: column('assertion_xml', 'varchar(10000)'), // Using varchar for cross-platform compatibility
  signature_valid: column('signature_valid', 'bool'),
  issued_at: column('issued_at', 'timestamp'),
  expires_at: column('expires_at', 'timestamp'),
  consumed_at: column('consumed_at', 'timestamp').nullable(),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
}).unique('sso_assertion_id_uk', ['assertion_id']);

// SSO Requests Table  
export const ssoRequests = table('sso_requests', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  request_id: column('request_id', 'varchar(255)'),
  provider_id: column('provider_id', 'varchar(255)'),
  user_id: column('user_id', 'varchar(255)').nullable(),
  request_type: column('request_type', 'varchar(50)'), // 'auth', 'logout'
  relay_state: column('relay_state', 'varchar(1000)').nullable(),
  destination_url: column('destination_url', 'varchar(1000)').nullable(),
  request_xml: column('request_xml', 'varchar(10000)').nullable(),
  response_xml: column('response_xml', 'varchar(10000)').nullable(),
  status: column('status', 'varchar(50)'), // 'pending', 'completed', 'failed', 'timeout'
  expires_at: column('expires_at', 'timestamp'),
  completed_at: column('completed_at', 'timestamp').nullable(),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
}).unique('sso_request_id_uk', ['request_id']);

// Federated Sessions Table
export const ssoFederatedSessions = table('sso_federated_sessions', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  session_token: column('session_token', 'varchar(255)'),
  user_id: column('user_id', 'varchar(255)'),
  provider_sessions: column('provider_sessions', 'json'), // Map of provider -> session info
  domains: column('domains', 'json'), // Array of domains where session is valid
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  expires_at: column('expires_at', 'timestamp'),
  last_activity: column('last_activity', 'timestamp').defaultTo$('now'),
}).unique('sso_session_token_uk', ['session_token']);

// Logout Requests Table
export const ssoLogoutRequests = table('sso_logout_requests', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  logout_id: column('logout_id', 'varchar(255)'),
  user_id: column('user_id', 'varchar(255)'),
  initiating_provider_id: column('initiating_provider_id', 'varchar(255)'),
  target_providers: column('target_providers', 'json'), // Array of provider IDs
  relay_state: column('relay_state', 'varchar(1000)').nullable(),
  status: column('status', 'varchar(50)').defaultTo$('pending'), // 'pending', 'completed', 'failed'
  completed_providers: column('completed_providers', 'json'), // Array of provider IDs
  failed_providers: column('failed_providers', 'json'), // Array of provider IDs
  expires_at: column('expires_at', 'timestamp'),
  completed_at: column('completed_at', 'timestamp').nullable(),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
}).unique('sso_logout_id_uk', ['logout_id']);

export const singleSignOnSchemaV2: ReauthSchemaPlugin = {
  tables: {
    sso_identity_providers: ssoIdentityProviders,
    sso_sessions: ssoSessions,
    sso_saml_assertions: ssoSamlAssertions,
    sso_requests: ssoRequests,
    sso_federated_sessions: ssoFederatedSessions,
    sso_logout_requests: ssoLogoutRequests,
  },
  relations: {
    // Relations can be defined here if needed
    // For example: sso_sessions -> sso_identity_providers
    sso_sessions_provider: {
      type: 'many-to-one',
      from: 'sso_sessions.provider_id',
      to: 'sso_identity_providers.id',
    },
    sso_saml_assertions_provider: {
      type: 'many-to-one',
      from: 'sso_saml_assertions.provider_id', 
      to: 'sso_identity_providers.id',
    },
    sso_requests_provider: {
      type: 'many-to-one',
      from: 'sso_requests.provider_id',
      to: 'sso_identity_providers.id',
    },
    sso_logout_requests_provider: {
      type: 'many-to-one',
      from: 'sso_logout_requests.initiating_provider_id',
      to: 'sso_identity_providers.id',
    },
  },
};