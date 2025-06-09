import * as arctic from 'arctic';
import {
  createOAuthPlugin,
  BaseOAuthConfig,
} from './utils/oauth-plugin-factory';

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
