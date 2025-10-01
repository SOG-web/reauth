import * as arctic from 'arctic';
import type {
  OAuthUserInfo,
  BaseOAuthConfig,
  OAuthProviderType,
  OAuthClientFactory,
  OAuthProviderConfig
} from './types';

/**
 * Default user info fetchers for common providers
 */
export const defaultUserInfoFetchers: Record<
  string,
  (accessToken: string, idToken?: string) => Promise<OAuthUserInfo>
> = {
  google: async (accessToken: string, idToken?: string) => {
    if (idToken) {
      const claims = arctic.decodeIdToken(idToken) as any;
      return {
        id: claims.sub,
        email: claims.email,
        name: claims.name,
        picture: claims.picture,
        verified_email: claims.email_verified,
      };
    }
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return await response.json();
  },

  facebook: async (accessToken: string) => {
    const response = await fetch(
      'https://graph.facebook.com/me?fields=id,name,email,picture',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const user = await response.json();
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture?.data?.url,
      verified_email: true,
    };
  },

  github: async (accessToken: string) => {
    const response = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    const user = await response.json();
    return {
      id: user.id.toString(),
      email: user.email,
      name: user.name || user.login,
      picture: user.avatar_url,
      verified_email: true,
      username: user.login,
      bio: user.bio,
      company: user.company,
      location: user.location,
      followers: user.followers,
      following: user.following,
    };
  },

  linkedin: async (accessToken: string, idToken?: string) => {
    if (idToken) {
      const claims = arctic.decodeIdToken(idToken) as any;
      return {
        id: claims.sub,
        email: claims.email,
        name: claims.name,
        picture: claims.picture,
        verified_email: claims.email_verified,
      };
    }
    const response = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const user = await response.json();
    return {
      id: user.sub,
      email: user.email,
      name: user.name,
      picture: user.picture,
      verified_email: true,
    };
  },

  discord: async (accessToken: string) => {
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status}`);
    }
    const user = await response.json();
    return {
      id: user.id,
      email: user.email,
      name: user.username,
      picture: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : undefined,
      verified_email: user.verified,
      username: user.username,
      discriminator: user.discriminator,
      global_name: user.global_name,
    };
  },

  spotify: async (accessToken: string) => {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }
    const user = await response.json();
    return {
      id: user.id,
      email: user.email,
      name: user.display_name,
      picture: user.images?.[0]?.url,
      verified_email: true,
      country: user.country,
      followers: user.followers?.total,
    };
  },

  microsoft: async (accessToken: string, idToken?: string) => {
    if (idToken) {
      const claims = arctic.decodeIdToken(idToken) as any;
      return {
        id: claims.sub,
        email: claims.email,
        name: claims.name,
        picture: claims.picture,
        verified_email: claims.email_verified,
      };
    }
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Microsoft Graph API error: ${response.status}`);
    }
    const user = await response.json();
    return {
      id: user.id,
      email: user.mail || user.userPrincipalName,
      name: user.displayName,
      verified_email: true,
      given_name: user.givenName,
      family_name: user.surname,
      job_title: user.jobTitle,
    };
  },

  twitter: async (accessToken: string) => {
    const response = await fetch(
      'https://api.twitter.com/2/users/me?user.fields=profile_image_url,verified',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!response.ok) {
      throw new Error(`Twitter API error: ${response.status}`);
    }
    const result = await response.json();
    const user = result.data;
    return {
      id: user.id,
      name: user.name,
      picture: user.profile_image_url,
      username: user.username,
      verified: user.verified,
    };
  },

  twitch: async (accessToken: string) => {
    const response = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID || '',
      },
    });
    if (!response.ok) {
      throw new Error(`Twitch API error: ${response.status}`);
    }
    const result = await response.json();
    const user = result.data[0];
    return {
      id: user.id,
      email: user.email,
      name: user.display_name,
      picture: user.profile_image_url,
      username: user.login,
      broadcaster_type: user.broadcaster_type,
    };
  },

  apple: async (accessToken: string, idToken?: string) => {
    if (!idToken) {
      throw new Error('Apple requires ID token for user info');
    }
    const claims = arctic.decodeIdToken(idToken) as any;
    return {
      id: claims.sub,
      email: claims.email,
      name: claims.name,
      verified_email: claims.email_verified,
    };
  },

  auth0: async (accessToken: string, idToken?: string) => {
    if (idToken) {
      const claims = arctic.decodeIdToken(idToken) as any;
      return {
        id: claims.sub,
        email: claims.email,
        name: claims.name,
        picture: claims.picture,
        verified_email: claims.email_verified,
      };
    }
    throw new Error('Auth0 requires ID token for user info');
  },
};

/**
 * Create an OAuth provider configuration
 */
export function createOAuthProvider<T extends BaseOAuthConfig>(
  name: string,
  type: OAuthProviderType,
  clientFactory: OAuthClientFactory<T>,
  defaultScopes: string[] = [],
  config: T,
): OAuthProviderConfig<T> {
  return {
    name,
    type,
    clientFactory,
    defaultScopes,
    config,
  };
}
