import * as arctic from 'arctic';
import {
  createOAuthPlugin,
  BaseOAuthConfig,
} from './utils/oauth-plugin-factory';
import { column } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../types';

/**
 * Spotify OAuth configuration
 */
export interface SpotifyOAuthConfig extends BaseOAuthConfig {
  /**
   * Additional Spotify-specific scopes (optional)
   * Default scopes: 'user-read-email', 'user-read-private'
   */
  scopes?: string[];
  /**
   * Whether to use PKCE flow (default: false for confidential clients)
   * Set to true for public clients (clientSecret should be null)
   */
  usePKCE?: boolean;
}

/**
 * Create Spotify OAuth plugin
 * Spotify supports both regular and PKCE flows
 */
export const spotifyOAuthPlugin = createOAuthPlugin<SpotifyOAuthConfig>(
  'Spotify',
  'pkce', // Spotify supports PKCE
  (config: SpotifyOAuthConfig) =>
    new arctic.Spotify(
      config.clientId,
      config.usePKCE ? null : config.clientSecret,
      config.redirectUri,
    ),
  ['user-read-email', 'user-read-private'], // Default scopes
);

export default spotifyOAuthPlugin;

export const spotifyOAuthSchema: ReauthSchemaPlugin = {
  extendTables: {
    entities: {
      spotify_id: column('spotify_id', 'varchar(255)').nullable().unique(),
      spotify_data: column('spotify_data', 'json').nullable(),
    },
  },
};
