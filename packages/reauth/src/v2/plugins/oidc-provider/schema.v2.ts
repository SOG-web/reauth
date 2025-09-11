/**
 * OIDC Provider Plugin V2 Database Schema
 * Complete schema for OpenID Connect Provider tables
 */

import { schema, table } from 'fumadb';

// OIDC Clients table
const oidcClientsTable = table({
  id: 'varchar(36)',
  client_id: 'varchar(255)',
  client_secret_hash: 'varchar(255)',
  client_name: 'varchar(255)',
  client_uri: 'string',
  logo_uri: 'string',
  tos_uri: 'string',
  policy_uri: 'string',
  jwks_uri: 'string',
  jwks: 'json',
  redirect_uris: 'json', // Array of strings
  post_logout_redirect_uris: 'json', // Array of strings
  grant_types: 'json', // Array of strings, default: ['authorization_code']
  response_types: 'json', // Array of strings, default: ['code']
  scopes: 'json', // Array of strings, default: ['openid']
  token_endpoint_auth_method: 'varchar(50)',
  id_token_signed_response_alg: 'varchar(10)',
  userinfo_signed_response_alg: 'varchar(10)',
  request_object_signing_alg: 'varchar(10)',
  application_type: 'varchar(20)', // 'web' or 'native'
  subject_type: 'varchar(20)', // 'public' or 'pairwise'
  sector_identifier_uri: 'string',
  require_auth_time: 'bool',
  default_max_age: 'integer',
  require_pushed_authorization_requests: 'bool',
  created_at: 'timestamp',
  updated_at: 'timestamp',
})
  .primaryKey('id')
  .unique(['client_id'])
  .index(['client_id'])
  .index(['created_at']);

// Authorization Codes table
const oidcAuthorizationCodesTable = table({
  id: 'varchar(36)',
  code: 'varchar(255)',
  client_id: 'varchar(255)',
  user_id: 'varchar(36)',
  redirect_uri: 'string',
  scopes: 'json', // Array of strings
  nonce: 'varchar(255)',
  state: 'varchar(255)',
  code_challenge: 'varchar(255)',
  code_challenge_method: 'varchar(10)', // 'S256' or 'plain'
  auth_time: 'timestamp',
  expires_at: 'timestamp',
  used_at: 'timestamp',
  created_at: 'timestamp',
})
  .primaryKey('id')
  .unique(['code'])
  .index(['code'])
  .index(['client_id'])
  .index(['user_id'])
  .index(['expires_at'])
  .index(['created_at']);

// Access Tokens table
const oidcAccessTokensTable = table({
  id: 'varchar(36)',
  token_hash: 'varchar(255)',
  client_id: 'varchar(255)',
  user_id: 'varchar(36)',
  scopes: 'json', // Array of strings
  token_type: 'varchar(20)', // 'Bearer'
  expires_at: 'timestamp',
  revoked_at: 'timestamp',
  created_at: 'timestamp',
})
  .primaryKey('id')
  .unique(['token_hash'])
  .index(['token_hash'])
  .index(['client_id'])
  .index(['user_id'])
  .index(['expires_at'])
  .index(['revoked_at'])
  .index(['created_at']);

// Refresh Tokens table
const oidcRefreshTokensTable = table({
  id: 'varchar(36)',
  token_hash: 'varchar(255)',
  access_token_id: 'varchar(36)',
  client_id: 'varchar(255)',
  user_id: 'varchar(36)',
  scopes: 'json', // Array of strings
  expires_at: 'timestamp',
  revoked_at: 'timestamp',
  created_at: 'timestamp',
})
  .primaryKey('id')
  .unique(['token_hash'])
  .index(['token_hash'])
  .index(['access_token_id'])
  .index(['client_id'])
  .index(['user_id'])
  .index(['expires_at'])
  .index(['revoked_at'])
  .index(['created_at']);

// ID Tokens table (for audit/tracking)
const oidcIdTokensTable = table({
  id: 'varchar(36)',
  jti: 'varchar(255)',
  client_id: 'varchar(255)',
  user_id: 'varchar(36)',
  audience: 'json', // Array of strings
  scopes: 'json', // Array of strings
  auth_time: 'timestamp',
  issued_at: 'timestamp',
  expires_at: 'timestamp',
  nonce: 'varchar(255)',
})
  .primaryKey('id')
  .unique(['jti'])
  .index(['jti'])
  .index(['client_id'])
  .index(['user_id'])
  .index(['expires_at'])
  .index(['issued_at']);

// Cryptographic Keys table
const oidcKeysTable = table({
  id: 'varchar(36)',
  key_id: 'varchar(255)',
  key_type: 'varchar(10)', // 'RSA', 'EC'
  key_use: 'varchar(10)', // 'sig', 'enc'
  algorithm: 'varchar(10)', // 'RS256', 'ES256', etc.
  public_key: 'string',
  private_key_encrypted: 'string',
  is_active: 'bool',
  created_at: 'timestamp',
  expires_at: 'timestamp',
})
  .primaryKey('id')
  .unique(['key_id'])
  .index(['key_id'])
  .index(['key_use'])
  .index(['is_active'])
  .index(['created_at'])
  .index(['expires_at']);

/**
 * OIDC Provider Schema V2
 * Complete database schema for OIDC provider functionality
 */
export const oidcProviderSchemaV2 = schema('1.0.0', {
  oidc_clients: oidcClientsTable,
  oidc_authorization_codes: oidcAuthorizationCodesTable,
  oidc_access_tokens: oidcAccessTokensTable,
  oidc_refresh_tokens: oidcRefreshTokensTable,
  oidc_id_tokens: oidcIdTokensTable,
  oidc_keys: oidcKeysTable,
});

// Export table references for use in steps
export {
  oidcClientsTable,
  oidcAuthorizationCodesTable,
  oidcAccessTokensTable,
  oidcRefreshTokensTable,
  oidcIdTokensTable,
  oidcKeysTable,
};

// Export type-safe table names
export const OIDC_TABLES = {
  CLIENTS: 'oidc_clients',
  AUTHORIZATION_CODES: 'oidc_authorization_codes',
  ACCESS_TOKENS: 'oidc_access_tokens',
  REFRESH_TOKENS: 'oidc_refresh_tokens',
  ID_TOKENS: 'oidc_id_tokens',
  KEYS: 'oidc_keys',
} as const;

export type OIDCTableNames = typeof OIDC_TABLES[keyof typeof OIDC_TABLES];