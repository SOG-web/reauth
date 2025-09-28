import { column, idColumn, table } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../../types';

/**
 * Generic OAuth Plugin V2 Database Schema
 * 
 * Comprehensive schema supporting OAuth 2.0 and OAuth 1.0a with security features.
 */

// OAuth providers configuration table
export const genericOauthProviders = table('generic_oauth_providers', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  name: column('name', 'varchar(100)'), // Provider identifier (e.g., 'google', 'github')
  version: column('version', 'varchar(10)'), // OAuth version: '1.0a' or '2.0'
  client_id_encrypted: column('client_id_encrypted', 'varchar(500)'), // Encrypted client ID
  client_secret_encrypted: column('client_secret_encrypted', 'varchar(500)'), // Encrypted client secret
  
  // OAuth 2.0 endpoints
  authorization_url: column('authorization_url', 'varchar(1000)').nullable(),
  token_url: column('token_url', 'varchar(1000)').nullable(),
  user_info_url: column('user_info_url', 'varchar(1000)').nullable(),
  
  // OAuth 1.0a endpoints
  request_token_url: column('request_token_url', 'varchar(1000)').nullable(),
  access_token_url: column('access_token_url', 'varchar(1000)').nullable(),
  
  // Discovery
  discovery_url: column('discovery_url', 'varchar(1000)').nullable(),
  
  // Configuration
  scopes: column('scopes', 'json').nullable(), // Array of default scopes
  profile_mapping: column('profile_mapping', 'json').nullable(), // Profile field mapping
  additional_params: column('additional_params', 'json').nullable(), // Additional OAuth params
  headers: column('headers', 'json').nullable(), // Custom request headers
  
  // Security settings
  pkce_enabled: column('pkce_enabled', 'boolean').defaultTo$(true),
  state_enabled: column('state_enabled', 'boolean').defaultTo$(true),
  signature_method: column('signature_method', 'varchar(20)').nullable(), // OAuth 1.0a signature method
  
  // Status
  is_active: column('is_active', 'boolean').defaultTo$(true),
  
  // Timestamps
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
}).unique('generic_oauth_provider_name_uk', ['name']);

// OAuth connections (linking users to OAuth accounts)
export const genericOauthConnections = table('generic_oauth_connections', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  user_id: column('user_id', 'varchar(255)'), // ReAuth user ID
  provider_id: column('provider_id', 'varchar(255)'), // Reference to generic_oauth_providers
  provider_user_id: column('provider_user_id', 'varchar(255)'), // User ID from OAuth provider
  
  // Token storage (encrypted)
  access_token_encrypted: column('access_token_encrypted', 'varchar(1000)').nullable(),
  refresh_token_encrypted: column('refresh_token_encrypted', 'varchar(1000)').nullable(),
  token_type: column('token_type', 'varchar(50)').defaultTo$('Bearer'),
  expires_at: column('expires_at', 'timestamp').nullable(),
  
  // Scope and profile data
  scopes: column('scopes', 'json').nullable(), // Array of granted scopes
  profile_data: column('profile_data', 'json').nullable(), // User profile from provider
  
  // Timestamps
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
  last_used_at: column('last_used_at', 'timestamp').nullable(),
}).unique('generic_oauth_connection_user_provider_uk', ['user_id', 'provider_id']);

// OAuth authorization sessions (temporary state for auth flow)
export const genericOauthAuthorizationSessions = table('generic_oauth_authorization_sessions', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  user_id: column('user_id', 'varchar(255)').nullable(), // Optional: for linking existing users
  provider_id: column('provider_id', 'varchar(255)'), // Reference to generic_oauth_providers
  
  // CSRF and PKCE protection
  state: column('state', 'varchar(255)'), // State parameter for CSRF protection
  code_verifier: column('code_verifier', 'varchar(255)').nullable(), // PKCE code verifier
  code_challenge: column('code_challenge', 'varchar(255)').nullable(), // PKCE code challenge
  
  // Flow data
  redirect_uri: column('redirect_uri', 'varchar(1000)'), // Callback URI
  scopes: column('scopes', 'json').nullable(), // Requested scopes
  
  // Lifecycle
  expires_at: column('expires_at', 'timestamp'), // Session expiration
  completed_at: column('completed_at', 'timestamp').nullable(), // When authorization completed
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
}).unique('generic_oauth_session_state_uk', ['state']);

// OAuth 1.0a request tokens (temporary tokens for three-legged flow)
export const genericOauth1RequestTokens = table('generic_oauth1_request_tokens', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  provider_id: column('provider_id', 'varchar(255)'), // Reference to generic_oauth_providers
  
  // OAuth 1.0a token data
  token: column('token', 'varchar(255)'), // Request token
  token_secret_encrypted: column('token_secret_encrypted', 'varchar(500)'), // Encrypted token secret
  callback_confirmed: column('callback_confirmed', 'boolean').defaultTo$(false),
  
  // Lifecycle
  expires_at: column('expires_at', 'timestamp'), // Token expiration
  used_at: column('used_at', 'timestamp').nullable(), // When token was used
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
});

// Foreign key relationships and indexes would be added here in a real implementation
// For fumadb, we define the relationships in the schema plugin

export const genericOauthSchemaV2: ReauthSchemaPlugin = {
  tables: {
    generic_oauth_providers: genericOauthProviders,
    generic_oauth_connections: genericOauthConnections,
    generic_oauth_authorization_sessions: genericOauthAuthorizationSessions,
    generic_oauth1_request_tokens: genericOauth1RequestTokens,
  },
};