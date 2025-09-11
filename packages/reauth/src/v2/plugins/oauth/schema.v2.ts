import { column, idColumn, table } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../../types';

// OAuth providers configuration table
export const oauthProviders = table('oauth_providers', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  name: column('name', 'varchar(100)'), // e.g., 'google', 'github', 'facebook'
  client_id: column('client_id', 'varchar(500)'),
  client_secret_hash: column('client_secret_hash', 'varchar(255)'),
  authorization_url: column('authorization_url', 'varchar(1000)'),
  token_url: column('token_url', 'varchar(1000)'),
  user_info_url: column('user_info_url', 'varchar(1000)'),
  scopes: column('scopes', 'json'), // Array of default scopes
  redirect_uri: column('redirect_uri', 'varchar(1000)'),
  is_active: column('is_active', 'boolean').defaultTo$(true),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
}).unique('oauth_provider_name_uk', ['name']);

// OAuth tokens for users
export const oauthTokens = table('oauth_tokens', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  subject_id: column('subject_id', 'varchar(255)'),
  provider_id: column('provider_id', 'varchar(255)'),
  access_token_hash: column('access_token_hash', 'varchar(255)'),
  refresh_token_hash: column('refresh_token_hash', 'varchar(255)').nullable(),
  expires_at: column('expires_at', 'timestamp').nullable(),
  scope: column('scope', 'text').nullable(),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
  last_used_at: column('last_used_at', 'timestamp').nullable(),
}).unique('oauth_token_subject_provider_uk', ['subject_id', 'provider_id']);

// OAuth user profiles from providers
export const oauthProfiles = table('oauth_profiles', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  subject_id: column('subject_id', 'varchar(255)'),
  provider_id: column('provider_id', 'varchar(255)'),
  provider_user_id: column('provider_user_id', 'varchar(255)'), // The user ID from the OAuth provider
  profile_data: column('profile_data', 'json'), // Raw profile data from provider
  email: column('email', 'varchar(255)').nullable(),
  name: column('name', 'varchar(255)').nullable(),
  avatar_url: column('avatar_url', 'varchar(1000)').nullable(),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
}).unique('oauth_profile_provider_user_uk', ['provider_id', 'provider_user_id']);

export const oauthSchemaV2: ReauthSchemaPlugin = {
  tables: {
    oauth_providers: oauthProviders,
    oauth_tokens: oauthTokens,
    oauth_profiles: oauthProfiles,
  },
  relations: {},
};