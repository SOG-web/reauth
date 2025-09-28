import type { Token } from '../types';

/**
 * Safely extract the access token string from a Token union (string | { accessToken, refreshToken } | null)
 */
export function extractAccessToken(token: Token): string | null {
  if (!token) return null;
  return typeof token === 'string' ? token : (token.accessToken ?? null);
}

/**
 * Compare two Token values for equality of their access tokens.
 * Handles string tokens and object tokens transparently.
 */
export function accessTokensEqual(a: Token, b?: Token | null): boolean {
  const aTok = extractAccessToken(a);
  const bTok = extractAccessToken(b as Token);
  return aTok === bTok;
}

/**
 * If the session token differs from the original token, attach the new token
 * to the provided result object (without mutating the original result).
 * Returns the updated result object.
 */
export function attachNewTokenIfDifferent<Result extends Record<string, any>>(
  result: Result,
  originalToken: Token | undefined | null,
  sessionToken: Token | undefined | null,
): Result {
  try {
    if (!originalToken) {
      if (sessionToken) {
        return { ...result, token: sessionToken } as Result;
      }
      return result;
    }

    if (!accessTokensEqual(originalToken, sessionToken)) {
      return { ...result, token: sessionToken } as Result;
    }
  } catch (_err) {
    // In case of unexpected errors, don't break the caller — return original
  }
  return result;
}
