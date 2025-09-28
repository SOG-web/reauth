import { ReAuthEngineV2 } from '../../engine.v2';
import { 
  createGoogleOAuthPlugin,
  createGitHubOAuthPlugin,
  createFacebookOAuthPlugin,
  createDiscordOAuthPlugin,
  createMicrosoftOAuthPlugin,
  createAppleOAuthPlugin,
  createOAuthPlugin,
  type OAuthConfigV2,
} from './index';

/**
 * Example 1: Single Provider Setup (Google)
 * 
 * Most common use case - single OAuth provider for authentication
 */
export function singleProviderExample() {
  const googleOAuth = createGoogleOAuthPlugin({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: 'http://localhost:3000/auth/google/callback',
    scopes: ['email', 'profile', 'openid'],
    sessionTtlSeconds: 86400, // 24 hours
  });

  const engine = new ReAuthEngineV2({
    dbClient: {} as any, // Your database client
    plugins: [googleOAuth],
  });

  return engine;
}

/**
 * Example 2: Multiple Provider Setup
 * 
 * Support multiple OAuth providers (Google, GitHub, Facebook)
 */
export function multipleProviderExample() {
  const googleOAuth = createGoogleOAuthPlugin({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: 'http://localhost:3000/auth/oauth/callback',
  });

  const githubOAuth = createGitHubOAuthPlugin({
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    redirectUri: 'http://localhost:3000/auth/oauth/callback',
  });

  const facebookOAuth = createFacebookOAuthPlugin({
    clientId: process.env.FACEBOOK_APP_ID!,
    clientSecret: process.env.FACEBOOK_APP_SECRET!,
    redirectUri: 'http://localhost:3000/auth/oauth/callback',
  });

  const engine = new ReAuthEngineV2({
    dbClient: {} as any, // Your database client
    plugins: [googleOAuth, githubOAuth, facebookOAuth],
  });

  return engine;
}

/**
 * Example 3: Enterprise Setup with All Major Providers
 * 
 * Enterprise application supporting all major OAuth providers
 */
export function enterpriseExample() {
  const googleOAuth = createGoogleOAuthPlugin({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: 'http://localhost:3000/auth/oauth/callback',
    scopes: ['email', 'profile', 'openid'],
  });

  const githubOAuth = createGitHubOAuthPlugin({
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    redirectUri: 'http://localhost:3000/auth/oauth/callback',
    scopes: ['user:email', 'read:user'],
  });

  const microsoftOAuth = createMicrosoftOAuthPlugin({
    clientId: process.env.MICROSOFT_CLIENT_ID!,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    redirectUri: 'http://localhost:3000/auth/oauth/callback',
    tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
    scopes: ['openid', 'profile', 'email', 'User.Read'],
  });

  const discordOAuth = createDiscordOAuthPlugin({
    clientId: process.env.DISCORD_CLIENT_ID!,
    clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    redirectUri: 'http://localhost:3000/auth/oauth/callback',
    scopes: ['identify', 'email', 'guilds'],
  });

  const appleOAuth = createAppleOAuthPlugin({
    clientId: process.env.APPLE_CLIENT_ID!,
    teamId: process.env.APPLE_TEAM_ID!,
    keyId: process.env.APPLE_KEY_ID!,
    privateKey: process.env.APPLE_PRIVATE_KEY!,
    redirectUri: 'http://localhost:3000/auth/oauth/callback',
    scopes: ['name', 'email'],
  });

  const engine = new ReAuthEngineV2({
    dbClient: {} as any, // Your database client
    plugins: [
      googleOAuth,
      githubOAuth,
      microsoftOAuth,
      discordOAuth,
      appleOAuth,
    ],
  });

  return engine;
}

/**
 * Example 4: Advanced Configuration with Account Linking
 * 
 * Allow users to link multiple OAuth accounts to one profile
 */
export function accountLinkingExample() {
  const oauthConfig: OAuthConfigV2 = {
    providers: [
      {
        name: 'google',
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        scopes: ['email', 'profile', 'openid'],
        redirectUri: 'http://localhost:3000/auth/oauth/callback',
        isActive: true,
      },
      {
        name: 'github',
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        scopes: ['user:email', 'read:user'],
        redirectUri: 'http://localhost:3000/auth/oauth/callback',
        isActive: true,
      },
    ],
    allowAccountLinking: true, // Enable linking multiple OAuth accounts
    requireEmailVerification: false, // Skip email verification for OAuth users
    sessionTtlSeconds: 2592000, // 30 days
    autoRefreshTokens: true, // Automatically refresh tokens
    tokenRefreshIntervalSeconds: 3000, // Refresh 5 minutes before expiry
  };

  const oauthPlugin = createOAuthPlugin({ config: oauthConfig });

  const engine = new ReAuthEngineV2({
    dbClient: {} as any, // Your database client
    plugins: [oauthPlugin],
  });

  return engine;
}

/**
 * Example 5: OAuth Flow Implementation Functions
 * 
 * Complete OAuth flow functions for web applications
 */
export class OAuthFlowExample {
  constructor(private engine: ReAuthEngineV2) {}

  /**
   * Step 1: Initiate OAuth flow
   * Call this when user clicks "Sign in with [Provider]"
   */
  async initiateOAuth(provider: string, redirectUri: string) {
    // Generate secure random state for CSRF protection
    const state = this.generateSecureState();
    
    const result = await this.engine.executeStep('oauth', 'initiate-oauth', {
      provider,
      redirectUri,
      state,
    });

    if (result.success) {
      // Store state in session/cookie for verification
      // In production, store this securely (e.g., encrypted cookie, session store)
      return {
        authorizationUrl: result.authorizationUrl,
        state, // Store this for later verification
      };
    } else {
      throw new Error(`OAuth initiation failed: ${result.error}`);
    }
  }

  /**
   * Step 2: Handle OAuth callback
   * Call this when OAuth provider redirects back to your app
   */
  async handleOAuthCallback(
    provider: string,
    code: string,
    state: string,
    expectedState: string,
    redirectUri: string
  ) {
    // Verify CSRF state parameter
    if (state !== expectedState) {
      throw new Error('Invalid state parameter - possible CSRF attack');
    }

    const result = await this.engine.executeStep('oauth', 'callback-oauth', {
      provider,
      code,
      state,
      redirectUri,
    });

    if (result.success) {
      return {
        user: result.user,
        session: result.session,
        isNewUser: result.isNewUser,
      };
    } else {
      throw new Error(`OAuth callback failed: ${result.error}`);
    }
  }

  /**
   * Step 3: Link OAuth account to existing user
   * Call this when user wants to connect another OAuth account
   */
  async linkOAuthAccount(
    provider: string,
    userId: string,
    oauthUserId: string
  ) {
    const result = await this.engine.executeStep('oauth', 'link-oauth', {
      provider,
      userId,
      oauthUserId,
    });

    if (result.success) {
      return { message: result.message };
    } else {
      throw new Error(`Account linking failed: ${result.error}`);
    }
  }

  /**
   * Step 4: Unlink OAuth account
   * Call this when user wants to remove OAuth account connection
   */
  async unlinkOAuthAccount(provider: string, userId: string) {
    const result = await this.engine.executeStep('oauth', 'unlink-oauth', {
      provider,
      userId,
    });

    if (result.success) {
      return { message: result.message };
    } else {
      throw new Error(`Account unlinking failed: ${result.error}`);
    }
  }

  /**
   * Step 5: Refresh OAuth token
   * Call this when access token expires
   */
  async refreshOAuthToken(
    provider: string,
    userId: string,
    refreshToken: string
  ) {
    const result = await this.engine.executeStep('oauth', 'refresh-token', {
      provider,
      userId,
      refreshToken,
    });

    if (result.success) {
      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
      };
    } else {
      throw new Error(`Token refresh failed: ${result.error}`);
    }
  }

  /**
   * Step 6: Get user profile from OAuth provider
   * Call this to fetch latest user profile data
   */
  async getOAuthProfile(provider: string, userId: string) {
    const result = await this.engine.executeStep('oauth', 'get-profile', {
      provider,
      userId,
    });

    if (result.success) {
      return {
        profile: result.profile,
        provider: result.provider,
      };
    } else {
      throw new Error(`Profile fetch failed: ${result.error}`);
    }
  }

  /**
   * Helper: Generate secure random state for CSRF protection
   */
  private generateSecureState(): string {
    // In production, use a cryptographically secure random generator
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}

/**
 * Example 6: Express.js Route Implementation
 * 
 * Complete Express.js routes for OAuth flows
 */
export function expressOAuthRoutes() {
  const express = require('express');
  const router = express.Router();
  
  // Setup OAuth engine
  const googleOAuth = createGoogleOAuthPlugin({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: 'http://localhost:3000/auth/google/callback',
  });

  const engine = new ReAuthEngineV2({
    dbClient: {} as any, // Your database client
    plugins: [googleOAuth],
  });

  const oauthFlow = new OAuthFlowExample(engine);

  // Initiate OAuth flow
  router.get('/auth/:provider', async (req: any, res: any) => {
    try {
      const { provider } = req.params;
      const redirectUri = `${req.protocol}://${req.get('host')}/auth/${provider}/callback`;
      
      const { authorizationUrl, state } = await oauthFlow.initiateOAuth(provider, redirectUri);
      
      // Store state in session for CSRF protection
      req.session.oauthState = state;
      
      res.redirect(authorizationUrl);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Handle OAuth callback
  router.get('/auth/:provider/callback', async (req: any, res: any) => {
    try {
      const { provider } = req.params;
      const { code, state } = req.query;
      const expectedState = req.session.oauthState;
      const redirectUri = `${req.protocol}://${req.get('host')}/auth/${provider}/callback`;
      
      const { user, session, isNewUser } = await oauthFlow.handleOAuthCallback(
        provider,
        code as string,
        state as string,
        expectedState,
        redirectUri
      );
      
      // Set authentication session
      req.session.userId = user.id;
      req.session.sessionId = session.id;
      
      // Clear OAuth state
      delete req.session.oauthState;
      
      // Redirect based on whether user is new or existing
      if (isNewUser) {
        res.redirect('/welcome');
      } else {
        res.redirect('/dashboard');
      }
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Link OAuth account (requires authentication)
  router.post('/auth/link/:provider', async (req: any, res: any) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { provider } = req.params;
      const { oauthUserId } = req.body;
      
      const result = await oauthFlow.linkOAuthAccount(
        provider,
        req.session.userId,
        oauthUserId
      );
      
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Unlink OAuth account (requires authentication)
  router.delete('/auth/unlink/:provider', async (req: any, res: any) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { provider } = req.params;
      
      const result = await oauthFlow.unlinkOAuthAccount(
        provider,
        req.session.userId
      );
      
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  return router;
}

/**
 * Example 7: Next.js App Router Implementation
 * 
 * OAuth routes for Next.js App Router (app directory)
 */
export function nextjsOAuthExample() {
  // app/auth/[provider]/route.ts
  const initiateOAuthHandler = async (request: Request, { params }: { params: { provider: string } }) => {
    const provider = params.provider;
    const url = new URL(request.url);
    const redirectUri = `${url.origin}/auth/${provider}/callback`;
    
    const googleOAuth = createGoogleOAuthPlugin({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri,
    });

    const engine = new ReAuthEngineV2({
      dbClient: {} as any,
      plugins: [googleOAuth],
    });

    const oauthFlow = new OAuthFlowExample(engine);
    
    try {
      const { authorizationUrl, state } = await oauthFlow.initiateOAuth(provider, redirectUri);
      
      const response = Response.redirect(authorizationUrl);
      
      // Set secure cookie with state
      response.headers.set('Set-Cookie', 
        `oauth-state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`
      );
      
      return response;
    } catch (error) {
      return Response.json({ error: (error as Error).message }, { status: 400 });
    }
  };

  // app/auth/[provider]/callback/route.ts
  const callbackOAuthHandler = async (request: Request, { params }: { params: { provider: string } }) => {
    const provider = params.provider;
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    // Get state from cookie
    const cookies = request.headers.get('cookie');
    const expectedState = cookies?.match(/oauth-state=([^;]+)/)?.[1];
    
    if (!code || !state || !expectedState) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const redirectUri = `${url.origin}/auth/${provider}/callback`;
    
    const googleOAuth = createGoogleOAuthPlugin({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri,
    });

    const engine = new ReAuthEngineV2({
      dbClient: {} as any,
      plugins: [googleOAuth],
    });

    const oauthFlow = new OAuthFlowExample(engine);
    
    try {
      const { user, session, isNewUser } = await oauthFlow.handleOAuthCallback(
        provider,
        code,
        state,
        expectedState,
        redirectUri
      );
      
      // Set authentication cookies
      const response = Response.redirect(isNewUser ? '/welcome' : '/dashboard');
      
      response.headers.append('Set-Cookie', 
        `session=${session.id}; HttpOnly; Secure; SameSite=Lax; Max-Age=86400; Path=/`
      );
      
      // Clear OAuth state cookie
      response.headers.append('Set-Cookie', 
        `oauth-state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`
      );
      
      return response;
    } catch (error) {
      return Response.json({ error: (error as Error).message }, { status: 400 });
    }
  };

  return {
    initiateOAuthHandler,
    callbackOAuthHandler,
  };
}

/**
 * Example 8: Error Handling and Retry Logic
 * 
 * Robust error handling for OAuth flows
 */
export class RobustOAuthFlow extends OAuthFlowExample {
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  /**
   * Handle OAuth callback with retry logic
   */
  async handleOAuthCallbackWithRetry(
    provider: string,
    code: string,
    state: string,
    expectedState: string,
    redirectUri: string,
    retryCount = 0
  ): Promise<any> {
    try {
      return await this.handleOAuthCallback(provider, code, state, expectedState, redirectUri);
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      // Determine if error is retryable
      const isRetryable = this.isRetryableError(errorMessage);
      
      if (isRetryable && retryCount < this.maxRetries) {
        console.warn(`OAuth callback failed (attempt ${retryCount + 1}/${this.maxRetries + 1}): ${errorMessage}`);
        
        // Wait before retrying
        await this.delay(this.retryDelay * Math.pow(2, retryCount)); // Exponential backoff
        
        return this.handleOAuthCallbackWithRetry(
          provider,
          code,
          state,
          expectedState,
          redirectUri,
          retryCount + 1
        );
      }
      
      // If not retryable or max retries reached, throw error
      throw error;
    }
  }

  /**
   * Refresh OAuth token with retry logic
   */
  async refreshOAuthTokenWithRetry(
    provider: string,
    userId: string,
    refreshToken: string,
    retryCount = 0
  ): Promise<any> {
    try {
      return await this.refreshOAuthToken(provider, userId, refreshToken);
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      if (this.isRetryableError(errorMessage) && retryCount < this.maxRetries) {
        console.warn(`Token refresh failed (attempt ${retryCount + 1}/${this.maxRetries + 1}): ${errorMessage}`);
        
        await this.delay(this.retryDelay * Math.pow(2, retryCount));
        
        return this.refreshOAuthTokenWithRetry(provider, userId, refreshToken, retryCount + 1);
      }
      
      throw error;
    }
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(errorMessage: string): boolean {
    const retryableErrors = [
      'network timeout',
      'connection refused',
      'temporary failure',
      'rate limit',
      'server error',
      '5', // HTTP 5xx errors
    ];

    return retryableErrors.some(pattern => 
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export all examples
export {
  singleProviderExample,
  multipleProviderExample,
  enterpriseExample,
  accountLinkingExample,
  OAuthFlowExample,
  expressOAuthRoutes,
  nextjsOAuthExample,
  RobustOAuthFlow,
};