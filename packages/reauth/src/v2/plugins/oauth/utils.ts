import crypto from 'crypto';
import type { OAuthState, OAuthTokenResponse, OAuthUserProfile } from '../types';
import type { OrmLike } from '../../../types.v2';

/**
 * Generate a secure random state parameter for OAuth flows
 */
export function generateOAuthState(provider: string, redirectUrl?: string): string {
  const state: OAuthState = {
    provider,
    redirectUrl,
    nonce: crypto.randomBytes(16).toString('hex'),
    timestamp: Date.now(),
  };
  
  return Buffer.from(JSON.stringify(state)).toString('base64url');
}

/**
 * Validate and parse OAuth state parameter
 */
export function validateOAuthState(stateParam: string, expectedProvider: string): OAuthState | null {
  try {
    const decoded = Buffer.from(stateParam, 'base64url').toString('utf-8');
    const state: OAuthState = JSON.parse(decoded);
    
    // Validate provider matches
    if (state.provider !== expectedProvider) {
      return null;
    }
    
    // Validate timestamp (max 10 minutes old)
    const maxAge = 10 * 60 * 1000; // 10 minutes
    if (Date.now() - state.timestamp > maxAge) {
      return null;
    }
    
    return state;
  } catch {
    return null;
  }
}

/**
 * Hash OAuth token for secure storage
 */
export function hashOAuthToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate authorization URL for OAuth provider
 */
export function generateAuthorizationUrl(
  authorizationUrl: string,
  clientId: string,
  redirectUri: string,
  scopes: string[],
  state: string,
  additionalParams?: Record<string, string>
): string {
  const url = new URL(authorizationUrl);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('state', state);
  
  // Add any additional provider-specific parameters
  if (additionalParams) {
    for (const [key, value] of Object.entries(additionalParams)) {
      url.searchParams.set(key, value);
    }
  }
  
  return url.toString();
}

/**
 * Exchange OAuth authorization code for tokens
 */
export async function exchangeCodeForTokens(
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
  additionalParams?: Record<string, string>
): Promise<OAuthTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    ...additionalParams,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OAuth token exchange failed: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<OAuthTokenResponse>;
}

/**
 * Fetch user profile from OAuth provider
 */
export async function fetchOAuthUserProfile(
  userInfoUrl: string,
  accessToken: string
): Promise<OAuthUserProfile> {
  const response = await fetch(userInfoUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OAuth user info fetch failed: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<OAuthUserProfile>;
}

/**
 * Refresh OAuth access token
 */
export async function refreshOAuthToken(
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<OAuthTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OAuth token refresh failed: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<OAuthTokenResponse>;
}

/**
 * Get OAuth provider configuration from database
 */
export async function getOAuthProvider(orm: OrmLike, providerName: string) {
  return await orm.findFirst('oauth_providers', {
    where: (b: any) => b('name', '=', providerName).and(b('is_active', '=', true)),
  });
}

/**
 * Store OAuth tokens securely in database
 */
export async function storeOAuthTokens(
  orm: OrmLike,
  subjectId: string,
  providerId: string,
  tokenResponse: OAuthTokenResponse
) {
  const expiresAt = tokenResponse.expires_in 
    ? new Date(Date.now() + tokenResponse.expires_in * 1000)
    : null;

  const tokenData = {
    subject_id: subjectId,
    provider_id: providerId,
    access_token_hash: hashOAuthToken(tokenResponse.access_token),
    refresh_token_hash: tokenResponse.refresh_token 
      ? hashOAuthToken(tokenResponse.refresh_token) 
      : null,
    expires_at: expiresAt,
    scope: tokenResponse.scope || null,
    updated_at: new Date(),
    last_used_at: new Date(),
  };

  // Upsert token record
  const existing = await orm.findFirst('oauth_tokens', {
    where: (b: any) => b('subject_id', '=', subjectId).and(b('provider_id', '=', providerId)),
  });

  if (existing) {
    return await orm.update('oauth_tokens', tokenData, {
      where: (b: any) => b('id', '=', existing.id),
    });
  } else {
    return await orm.insert('oauth_tokens', tokenData);
  }
}

/**
 * Store OAuth user profile in database
 */
export async function storeOAuthProfile(
  orm: OrmLike,
  subjectId: string,
  providerId: string,
  providerUserId: string,
  profile: OAuthUserProfile
) {
  const profileData = {
    subject_id: subjectId,
    provider_id: providerId,
    provider_user_id: providerUserId,
    profile_data: profile,
    email: profile.email || null,
    name: profile.name || null,
    avatar_url: profile.picture || null,
    updated_at: new Date(),
  };

  // Upsert profile record
  const existing = await orm.findFirst('oauth_profiles', {
    where: (b: any) => b('provider_id', '=', providerId).and(b('provider_user_id', '=', providerUserId)),
  });

  if (existing) {
    return await orm.update('oauth_profiles', profileData, {
      where: (b: any) => b('id', '=', existing.id),
    });
  } else {
    return await orm.insert('oauth_profiles', profileData);
  }
}