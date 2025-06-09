import * as arctic from 'arctic';
import { AuthPlugin, AuthStep, AuthInput, AuthOutput, PluginProp, Entity } from '../../../types';
import { type } from 'arktype';

/**
 * OAuth ID token claims structure
 */
interface OAuthIDTokenClaims {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
  [key: string]: any;
}

/**
 * Base configuration for OAuth providers
 */
export interface BaseOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
  /**
   * Custom function to fetch user info from the provider
   * Should return user data that can be used to create/link accounts
   */
  getUserInfo?: (accessToken: string, idToken?: string) => Promise<OAuthUserInfo>;
  /**
   * Custom function to handle account linking
   * Called when a user with OAuth account tries to link with existing account
   */
  onAccountLink?: (
    oauthUser: OAuthUserInfo,
    existingEntity: Entity,
    container: any,
  ) => Promise<Entity>;
  /**
   * Custom function to handle account creation
   * Called when creating a new account from OAuth data
   */
  onAccountCreate?: (
    oauthUser: OAuthUserInfo,
    container: any,
  ) => Promise<Partial<Entity>>;
  /**
   * Field name to use for finding existing accounts (default: 'email')
   */
  linkField?: string;
}

/**
 * OAuth user information structure
 */
export interface OAuthUserInfo {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
  verified_email?: boolean;
  [key: string]: any;
}

/**
 * OAuth provider types
 */
export type OAuthProviderType = 'regular' | 'pkce';

/**
 * OAuth client factory function type
 */
export type OAuthClientFactory<T extends BaseOAuthConfig> = (config: T) => any;

/**
 * Default user info fetchers for common providers
 */
export const defaultUserInfoFetchers: Record<string, (accessToken: string, idToken?: string) => Promise<OAuthUserInfo>> = {
  google: async (accessToken: string, idToken?: string) => {
    if (idToken) {
      const claims = arctic.decodeIdToken(idToken) as OAuthIDTokenClaims;
      return {
        id: claims.sub,
        email: claims.email,
        name: claims.name,
        picture: claims.picture,
        verified_email: claims.email_verified,
      };
    }
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return await response.json();
  },

  facebook: async (accessToken: string) => {
    const response = await fetch('https://graph.facebook.com/me?fields=id,name,email,picture', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return await response.json();
  },

  github: async (accessToken: string) => {
    const response = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return await response.json();
  },

  linkedin: async (accessToken: string, idToken?: string) => {
    if (idToken) {
      const claims = arctic.decodeIdToken(idToken) as OAuthIDTokenClaims;
      return {
        id: claims.sub,
        email: claims.email,
        name: claims.name,
        picture: claims.picture,
      };
    }
    const response = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return await response.json();
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
      picture: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : undefined,
      verified_email: user.verified,
      username: user.username,
      discriminator: user.discriminator,
      global_name: user.global_name,
    };
  },

  auth0: async (accessToken: string, idToken?: string) => {
    if (idToken) {
      const claims = arctic.decodeIdToken(idToken) as OAuthIDTokenClaims;
      return {
        id: claims.sub,
        email: claims.email,
        name: claims.name,
        picture: claims.picture,
        verified_email: claims.email_verified,
      };
    }
    // Auth0 doesn't have a standard userinfo endpoint, use ID token
    throw new Error('Auth0 requires ID token for user info');
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
      verified_email: true, // Spotify doesn't provide email verification status
      country: user.country,
      followers: user.followers?.total,
    };
  },

  microsoft: async (accessToken: string, idToken?: string) => {
    if (idToken) {
      const claims = arctic.decodeIdToken(idToken) as OAuthIDTokenClaims;
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
      verified_email: true, // Microsoft doesn't provide email verification status in this endpoint
      given_name: user.givenName,
      family_name: user.surname,
      job_title: user.jobTitle,
    };
  },

  twitter: async (accessToken: string) => {
    const response = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,verified', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
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
    const claims = arctic.decodeIdToken(idToken) as OAuthIDTokenClaims;
    return {
      id: claims.sub,
      email: claims.email,
      name: claims.name,
      verified_email: claims.email_verified,
    };
  },

  workos: async (accessToken: string, idToken?: string) => {
    if (idToken) {
      const claims = arctic.decodeIdToken(idToken) as OAuthIDTokenClaims;
      return {
        id: claims.sub,
        email: claims.email,
        name: claims.name,
        picture: claims.picture,
        verified_email: claims.email_verified,
      };
    }
    const response = await fetch('https://api.workos.com/user_management/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`WorkOS API error: ${response.status}`);
    }
    const user = await response.json();
    return {
      id: user.id,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`.trim(),
      verified_email: user.email_verified,
      first_name: user.first_name,
      last_name: user.last_name,
    };
  },

  reddit: async (accessToken: string) => {
    const response = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'ReAuth/1.0',
      },
    });
    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status}`);
    }
    const user = await response.json();
    return {
      id: user.id,
      name: user.name,
      picture: user.snoovatar_img,
      verified_email: user.has_verified_email,
      karma: user.total_karma,
    };
  },
};

/**
 * Creates a generic OAuth plugin for any Arctic provider
 */
export function createOAuthPlugin<T extends BaseOAuthConfig>(
  providerName: string,
  providerType: OAuthProviderType,
  clientFactory: OAuthClientFactory<T>,
  defaultScopes: string[] = [],
): (config: T) => AuthPlugin<T> {
  return (config: T): AuthPlugin<T> => {
    const client = clientFactory(config);
    const scopes = config.scopes || defaultScopes;
    const getUserInfo = config.getUserInfo || defaultUserInfoFetchers[providerName.toLowerCase()];
    const linkField = config.linkField || 'email';

    const steps: AuthStep<T>[] = [];

    // Step 1: Start OAuth flow
    steps.push({
      name: 'start',
      description: `Initiate ${providerName} OAuth flow`,
      inputs: [],
      protocol: {
        http: {
          method: 'GET',
          success: 302, // Redirect
        },
      },
      async run(input: AuthInput, { container }: PluginProp<T>): Promise<AuthOutput> {
        try {
          const state = arctic.generateState();
          let url: string;
          let cookiesToSet: Record<string, string> = { oauth_state: state };

          if (providerType === 'pkce') {
            const codeVerifier = arctic.generateCodeVerifier();
            url = client.createAuthorizationURL(state, codeVerifier, scopes);
            cookiesToSet.oauth_code_verifier = codeVerifier;
          } else {
            url = client.createAuthorizationURL(state, scopes);
          }

          return {
            success: true,
            message: `Redirecting to ${providerName}`,
            redirect: url,
            status: 'redirect',
            cookies: cookiesToSet,
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to start ${providerName} OAuth flow: ${error.message}`,
            status: 'error',
          };
        }
      },
    });

    // Step 2: Handle OAuth callback
    steps.push({
      name: 'callback',
      description: `Handle ${providerName} OAuth callback`,
      inputs: ['code', 'state'],
      validationSchema: type({
        code: 'string',
        state: 'string',
      }),
      protocol: {
        http: {
          method: 'POST',
          success: 200,
          error: 400,
        },
      },
      async run(input: AuthInput, { container }: PluginProp<T>): Promise<AuthOutput> {
        try {
          const { code, state, oauth_state, oauth_code_verifier } = input;

          // Verify state
          if (state !== oauth_state) {
            return {
              success: false,
              message: 'Invalid state parameter',
              status: 'error',
            };
          }

          // Exchange code for tokens
          let tokens;
          if (providerType === 'pkce') {
            if (!oauth_code_verifier) {
              return {
                success: false,
                message: 'Code verifier not found',
                status: 'error',
              };
            }
            tokens = await client.validateAuthorizationCode(code, oauth_code_verifier);
          } else {
            tokens = await client.validateAuthorizationCode(code);
          }

          const accessToken = tokens.accessToken();
          const idToken = tokens.idToken?.();

          // Get user info from provider
          if (!getUserInfo) {
            throw new Error(`No getUserInfo function provided for ${providerName}`);
          }
          const oauthUser = await getUserInfo(accessToken, idToken);

          // Look for existing entity by link field
          let entity: Entity | null = null;
          if (oauthUser[linkField]) {
            entity = await container.cradle.entityService.findEntity(
              oauthUser[linkField],
              linkField,
            );
          }

          // If entity exists, link the account or update
          if (entity) {
            if (config.onAccountLink) {
              entity = await config.onAccountLink(oauthUser, entity, container);
            }
            
            // Update entity with OAuth data
            const updatedEntity = await container.cradle.entityService.updateEntity(
              entity.id,
              'id',
              {
                ...entity,
                [`${providerName.toLowerCase()}_id`]: oauthUser.id,
                [`${providerName.toLowerCase()}_data`]: JSON.stringify(oauthUser),
              },
            );

            // Create session
            const sessionResult = await container.cradle.reAuthEngine.createSession(
              updatedEntity,
              `${providerName.toLowerCase()}-oauth.callback`,
            );

            if (!sessionResult.success) {
              return {
                success: false,
                message: sessionResult.message!,
                status: 'error',
              };
            }

            const serializedEntity = container.cradle.serializeEntity(updatedEntity);

            return {
              success: true,
              message: `${providerName} account linked successfully`,
              token: sessionResult.token,
              entity: serializedEntity,
              status: 'success',
            };
          }

          // Create new entity
          let entityData: Partial<Entity> = {
            email: oauthUser.email,
            email_verified: oauthUser.verified_email || false,
            [`${providerName.toLowerCase()}_id`]: oauthUser.id,
            [`${providerName.toLowerCase()}_data`]: JSON.stringify(oauthUser),
          };

          if (config.onAccountCreate) {
            const customData = await config.onAccountCreate(oauthUser, container);
            entityData = { ...entityData, ...customData };
          }

          const newEntity = await container.cradle.entityService.createEntity(entityData);

          // Create session
          const sessionResult = await container.cradle.reAuthEngine.createSession(
            newEntity,
            `${providerName.toLowerCase()}-oauth.callback`,
          );

          if (!sessionResult.success) {
            return {
              success: false,
              message: sessionResult.message!,
              status: 'error',
            };
          }

          const serializedEntity = container.cradle.serializeEntity(newEntity);

          return {
            success: true,
            message: `${providerName} authentication successful`,
            token: sessionResult.token,
            entity: serializedEntity,
            status: 'success',
          };
        } catch (error: any) {
          console.error(`${providerName} OAuth error:`, error);
          return {
            success: false,
            message: `${providerName} authentication failed: ${error.message}`,
            status: 'error',
          };
        }
      },
    });

    // Step 3: Link existing account
    steps.push({
      name: 'link',
      description: `Link ${providerName} account to existing user`,
      inputs: ['code', 'state'],
      validationSchema: type({
        code: 'string',
        state: 'string',
      }),
      outputs: type({
        "entity?": 'object',
        "token?": 'string',
        "message": 'string',
        "status": 'string',
        "success": 'boolean',
      }),
      protocol: {
        http: {
          method: 'POST',
          auth: true, // Requires authentication
          success: 200,
          error: 400,
        },
      },
      async run(input: AuthInput, { container }: PluginProp<T>): Promise<AuthOutput> {
        try {
          const { code, state, oauth_state, oauth_code_verifier, entity } = input;

          if (!entity) {
            return {
              success: false,
              message: 'Authentication required',
              status: 'unauthorized',
            };
          }

          // Verify state
          if (state !== oauth_state) {
            return {
              success: false,
              message: 'Invalid state parameter',
              status: 'error',
            };
          }

          // Exchange code for tokens
          let tokens;
          if (providerType === 'pkce') {
            if (!oauth_code_verifier) {
              return {
                success: false,
                message: 'Code verifier not found',
                status: 'error',
              };
            }
            tokens = await client.validateAuthorizationCode(code, oauth_code_verifier);
          } else {
            tokens = await client.validateAuthorizationCode(code);
          }

          const accessToken = tokens.accessToken();
          const idToken = tokens.idToken?.();

          // Get user info from provider
          if (!getUserInfo) {
            throw new Error(`No getUserInfo function provided for ${providerName}`);
          }
          const oauthUser = await getUserInfo(accessToken, idToken);

          // Check if OAuth account is already linked to another user
          const existingEntity = await container.cradle.entityService.findEntity(
            oauthUser.id,
            `${providerName.toLowerCase()}_id`,
          );

          if (existingEntity && existingEntity.id !== entity.id) {
            return {
              success: false,
              message: `${providerName} account is already linked to another user`,
              status: 'conflict',
            };
          }

          // Link the account
          let updatedEntity = entity;
          if (config.onAccountLink) {
            updatedEntity = await config.onAccountLink(oauthUser, entity, container);
          }

          // Update entity with OAuth data
          const finalEntity = await container.cradle.entityService.updateEntity(
            entity.id,
            'id',
            {
              ...updatedEntity,
              [`${providerName.toLowerCase()}_id`]: oauthUser.id,
              [`${providerName.toLowerCase()}_data`]: JSON.stringify(oauthUser),
            },
          );

          const serializedEntity = container.cradle.serializeEntity(finalEntity);

          return {
            success: true,
            message: `${providerName} account linked successfully`,
            entity: serializedEntity,
            status: 'success',
          };
        } catch (error: any) {
          console.error(`${providerName} OAuth link error:`, error);
          return {
            success: false,
            message: `Failed to link ${providerName} account: ${error.message}`,
            status: 'error',
          };
        }
      },
    });

    // Step 4: Unlink account
    steps.push({
      name: 'unlink',
      description: `Unlink ${providerName} account from user`,
      inputs: ['entity'],
      validationSchema: type({
        entity: 'object',
      }),
      outputs: type({
        "entity?": 'object',
        "message": 'string',
        "status": 'string',
        "success": 'boolean',
      }),
      protocol: {
        http: {
          method: 'POST',
          auth: true, // Requires authentication
          success: 200,
          error: 400,
        },
      },
      async run(input: AuthInput, { container }: PluginProp<T>): Promise<AuthOutput> {
        try {
          const { entity } = input;

          if (!entity) {
            return {
              success: false,
              message: 'Authentication required',
              status: 'unauthorized',
            };
          }

          // Check if account is linked
          if (!entity[`${providerName.toLowerCase()}_id`]) {
            return {
              success: false,
              message: `${providerName} account is not linked`,
              status: 'not_found',
            };
          }

          // Unlink the account
          const updatedEntity = await container.cradle.entityService.updateEntity(
            entity.id,
            'id',
            {
              ...entity,
              [`${providerName.toLowerCase()}_id`]: null,
              [`${providerName.toLowerCase()}_data`]: null,
            },
          );

          const serializedEntity = container.cradle.serializeEntity(updatedEntity);

          return {
            success: true,
            message: `${providerName} account unlinked successfully`,
            entity: serializedEntity,
            status: 'success',
          };
        } catch (error: any) {
          console.error(`${providerName} OAuth unlink error:`, error);
          return {
            success: false,
            message: `Failed to unlink ${providerName} account: ${error.message}`,
            status: 'error',
          };
        }
      },
    });

    return {
      name: `${providerName.toLowerCase()}OAuthPlugin`,
      steps,
      config,
      async initialize() {},
      getSensitiveFields() {
        return [`${providerName.toLowerCase()}_data`];
      },
      migrationConfig: {
        pluginName: `${providerName.toLowerCase()}-oauth`,
        extendTables: [
          {
            tableName: 'entities',
            columns: {
              [`${providerName.toLowerCase()}_id`]: {
                type: 'string',
                nullable: true,
                unique: true,
              },
              [`${providerName.toLowerCase()}_data`]: {
                type: 'json',
                nullable: true,
              },
            },
            indexes: [
              {
                columns: [`${providerName.toLowerCase()}_id`],
                unique: true,
              },
            ],
          },
        ],
      },
    };
  };
} 