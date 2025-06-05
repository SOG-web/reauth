/**
 * Example usage of OAuth plugins with ReAuth
 * This file demonstrates how to set up and use OAuth authentication
 * with Google, Facebook, GitHub, and LinkedIn
 */

import { createReAuthEngine } from '../../auth-engine';
import { KnexEntityService, KnexSessionService } from '../../services';
import {
  googleOAuthPlugin,
  facebookOAuthPlugin,
  githubOAuthPlugin,
  linkedinOAuthPlugin,
  type GoogleOAuthConfig,
  type FacebookOAuthConfig,
  type GitHubOAuthConfig,
  type LinkedInOAuthConfig,
} from './index';
import { type Entity } from '../../types';
import knex, { Knex } from 'knex';

// Extend the Entity type for OAuth example
interface ExtendedEntity extends Entity {
  name?: string;
  avatar_url?: string;
  username?: string;
  bio?: string;
}

// Example: Setting up OAuth authentication with custom hooks
export function createOAuthExample(database: Knex) {
  const entityService = new KnexEntityService(database, 'entities');
  const sessionService = new KnexSessionService(database, 'sessions');

  // Configure Google OAuth with custom account creation logic
  const googleConfig: GoogleOAuthConfig = {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: process.env.GOOGLE_REDIRECT_URI!,
    scopes: ['openid', 'email', 'profile'], // Optional: override defaults
    onAccountCreate: async (oauthUser, container) => {
      console.log('Creating new account from Google OAuth:', oauthUser.email);
      return {
        email: oauthUser.email,
        name: oauthUser.name,
        role: 'user',
        email_verified: oauthUser.verified_email || false,
        // Add any additional fields you need
        avatar_url: oauthUser.picture,
      };
    },
    onAccountLink: async (oauthUser, existingEntity, container) => {
      console.log('Linking Google account to existing user:', existingEntity.email);
      const extended = existingEntity as ExtendedEntity;
      return {
        ...extended,
        // Update fields if needed
        name: oauthUser.name || extended.name,
        avatar_url: oauthUser.picture || extended.avatar_url,
      };
    },
  };

  // Configure GitHub OAuth with custom user info fetching
  const githubConfig: GitHubOAuthConfig = {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    redirectUri: process.env.GITHUB_REDIRECT_URI!,
    scopes: ['user:email', 'read:user'],
    getUserInfo: async (accessToken) => {
      // Custom GitHub user info fetching with additional data
      const [userResponse, emailsResponse] = await Promise.all([
        fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch('https://api.github.com/user/emails', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      const user = await userResponse.json();
      const emails = await emailsResponse.json();
      
      // Find primary email
      const primaryEmail = emails.find((email: any) => email.primary) || emails[0];

      return {
        id: user.id.toString(),
        email: primaryEmail?.email || user.email,
        name: user.name || user.login,
        picture: user.avatar_url,
        verified_email: primaryEmail?.verified || false,
        username: user.login,
        bio: user.bio,
        company: user.company,
        location: user.location,
      };
    },
    onAccountCreate: async (oauthUser, container) => {
      console.log('Creating new account from GitHub OAuth:', oauthUser.email);
      return {
        email: oauthUser.email,
        name: oauthUser.name,
        role: 'developer', // GitHub users get 'developer' role
        email_verified: oauthUser.verified_email || false,
        avatar_url: oauthUser.picture,
        username: oauthUser.username,
        bio: oauthUser.bio,
      };
    },
  };

  // Configure Facebook OAuth
  const facebookConfig: FacebookOAuthConfig = {
    clientId: process.env.FACEBOOK_CLIENT_ID!,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    redirectUri: process.env.FACEBOOK_REDIRECT_URI!,
    scopes: ['email', 'public_profile'],
    onAccountCreate: async (oauthUser, container) => {
      console.log('Creating new account from Facebook OAuth:', oauthUser.email);
      // Handle Facebook picture which can be either string or object
      const pictureUrl = typeof oauthUser.picture === 'string' 
        ? oauthUser.picture 
        : (oauthUser.picture as any)?.data?.url;
      
      return {
        email: oauthUser.email,
        name: oauthUser.name,
        role: 'user',
        email_verified: false, // Facebook doesn't provide email verification status
        avatar_url: pictureUrl,
      };
    },
  };

  // Configure LinkedIn OAuth
  const linkedinConfig: LinkedInOAuthConfig = {
    clientId: process.env.LINKEDIN_CLIENT_ID!,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
    redirectUri: process.env.LINKEDIN_REDIRECT_URI!,
    scopes: ['openid', 'profile', 'email'],
    onAccountCreate: async (oauthUser, container) => {
      console.log('Creating new account from LinkedIn OAuth:', oauthUser.email);
      return {
        email: oauthUser.email,
        name: oauthUser.name,
        role: 'professional', // LinkedIn users get 'professional' role
        email_verified: true, // LinkedIn emails are generally verified
        avatar_url: oauthUser.picture,
      };
    },
  };

  // Create ReAuth engine with OAuth plugins
  const reAuth = createReAuthEngine({
    plugins: [
      googleOAuthPlugin(googleConfig),
      githubOAuthPlugin(githubConfig),
      facebookOAuthPlugin(facebookConfig),
      linkedinOAuthPlugin(linkedinConfig),
    ],
    entity: entityService,
    session: sessionService,
  });

  return reAuth;
}

// Example: Express.js route handlers
export function createExpressRoutes(reAuth: any) {
  const express = require('express');
  const router = express.Router();

  // Google OAuth routes
  router.get('/google/start', async (req: any, res: any) => {
    const result = await reAuth.executeStep('google-oauth', 'start', {});
    if (result.redirect) {
      return res.redirect(result.redirect);
    }
    return res.status(400).json(result);
  });

  router.post('/google/callback', async (req: any, res: any) => {
    const { code, state } = req.body;
    const result = await reAuth.executeStep('google-oauth', 'callback', { 
      code, 
      state,
      oauth_state: req.cookies.oauth_state,
      oauth_code_verifier: req.cookies.oauth_code_verifier,
    });
    
    if (result.success && result.token) {
      res.cookie('auth_token', result.token, { httpOnly: true });
    }
    
    return res.json(result);
  });

  // GitHub OAuth routes
  router.get('/github/start', async (req: any, res: any) => {
    const result = await reAuth.executeStep('github-oauth', 'start', {});
    if (result.redirect) {
      return res.redirect(result.redirect);
    }
    return res.status(400).json(result);
  });

  router.post('/github/callback', async (req: any, res: any) => {
    const { code, state } = req.body;
    const result = await reAuth.executeStep('github-oauth', 'callback', { 
      code, 
      state,
      oauth_state: req.cookies.oauth_state,
    });
    
    if (result.success && result.token) {
      res.cookie('auth_token', result.token, { httpOnly: true });
    }
    
    return res.json(result);
  });

  // Account linking routes (require authentication)
  router.post('/google/link', authenticateUser, async (req: any, res: any) => {
    const { code, state } = req.body;
    const result = await reAuth.executeStep('google-oauth', 'link', { 
      code, 
      state,
      oauth_state: req.cookies.oauth_state,
      oauth_code_verifier: req.cookies.oauth_code_verifier,
      entity: req.user,
    });
    
    return res.json(result);
  });

  router.post('/github/link', authenticateUser, async (req: any, res: any) => {
    const { code, state } = req.body;
    const result = await reAuth.executeStep('github-oauth', 'link', { 
      code, 
      state,
      oauth_state: req.cookies.oauth_state,
      entity: req.user,
    });
    
    return res.json(result);
  });

  // Account unlinking routes
  router.post('/google/unlink', authenticateUser, async (req: any, res: any) => {
    const result = await reAuth.executeStep('google-oauth', 'unlink', { 
      entity: req.user,
    });
    
    return res.json(result);
  });

  router.post('/github/unlink', authenticateUser, async (req: any, res: any) => {
    const result = await reAuth.executeStep('github-oauth', 'unlink', { 
      entity: req.user,
    });
    
    return res.json(result);
  });

  return router;
}

// Example middleware for authentication
function authenticateUser(req: any, res: any, next: any) {
  const token = req.cookies.auth_token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // You would implement token verification here
  // For this example, we'll assume the user is attached to req.user
  next();
}

// Example: Frontend integration helpers
export const frontendHelpers = {
  // Helper function to start OAuth flow
  startOAuthFlow: (provider: 'google' | 'github' | 'facebook' | 'linkedin') => {
    window.location.href = `/auth/${provider}-oauth/start`;
  },

  // Helper function to handle OAuth callback
  handleOAuthCallback: async (provider: 'google' | 'github' | 'facebook' | 'linkedin') => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (!code || !state) {
      throw new Error('Missing OAuth parameters');
    }

    const response = await fetch(`/auth/${provider}-oauth/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state }),
    });

    const result = await response.json();
    
    if (result.success && result.token) {
      // Store token and redirect to dashboard
      localStorage.setItem('auth_token', result.token);
      window.location.href = '/dashboard';
    } else {
      throw new Error(result.message || 'OAuth authentication failed');
    }
  },

  // Helper function to link OAuth account
  linkOAuthAccount: async (provider: 'google' | 'github' | 'facebook' | 'linkedin') => {
    return new Promise((resolve, reject) => {
      const authWindow = window.open(
        `/auth/${provider}-oauth/start`,
        'oauth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.code && event.data.state) {
          authWindow?.close();
          window.removeEventListener('message', handleMessage);

          try {
            const response = await fetch(`/auth/${provider}-oauth/link`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
              },
              body: JSON.stringify({
                code: event.data.code,
                state: event.data.state,
              }),
            });

            const result = await response.json();
            
            if (result.success) {
              resolve(result);
            } else {
              reject(new Error(result.message || 'Account linking failed'));
            }
          } catch (error) {
            reject(error);
          }
        }
      };

      window.addEventListener('message', handleMessage);

      // Handle window closed without completion
      const checkClosed = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          reject(new Error('OAuth window was closed'));
        }
      }, 1000);
    });
  },

  // Helper function to unlink OAuth account
  unlinkOAuthAccount: async (provider: 'google' | 'github' | 'facebook' | 'linkedin') => {
    const response = await fetch(`/auth/${provider}-oauth/unlink`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Account unlinking failed');
    }

    return result;
  },
};

// Example: React hooks for OAuth
export const useOAuth = () => {
  const login = (provider: 'google' | 'github' | 'facebook' | 'linkedin') => {
    frontendHelpers.startOAuthFlow(provider);
  };

  const link = async (provider: 'google' | 'github' | 'facebook' | 'linkedin') => {
    try {
      const result = await frontendHelpers.linkOAuthAccount(provider);
      console.log('Account linked successfully:', result);
      return result;
    } catch (error) {
      console.error('Account linking failed:', error);
      throw error;
    }
  };

  const unlink = async (provider: 'google' | 'github' | 'facebook' | 'linkedin') => {
    try {
      const result = await frontendHelpers.unlinkOAuthAccount(provider);
      console.log('Account unlinked successfully:', result);
      return result;
    } catch (error) {
      console.error('Account unlinking failed:', error);
      throw error;
    }
  };

  return { login, link, unlink };
}; 