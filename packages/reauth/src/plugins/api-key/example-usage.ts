import { Knex } from 'knex';
import { createReAuthEngine } from '../../auth-engine';
import { KnexEntityService, KnexSessionService } from '../../services';
import apiKeyAuth from './api-key.plugin';
import emailPasswordAuth from '../email-password/email-password.plugin';

/**
 * Example: Creating ReAuth engine with API key authentication
 */
export function createApiKeyAuthExample(knex: Knex) {
  const entityService = new KnexEntityService(knex, 'entities');
  const sessionService = new KnexSessionService(knex, 'sessions');

  const reAuth = createReAuthEngine({
    plugins: [
      // Include email-password for user registration
      emailPasswordAuth({
        verifyEmail: false,
        loginOnRegister: true,
      }),
      // Add API key plugin
      apiKeyAuth({
        maxKeysPerUser: 5, // Limit users to 5 API keys
        generateApiKey: () =>
          `ak_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      }),
    ],
    entity: entityService,
    session: sessionService,
  });

  return reAuth;
}

/**
 * Example workflow showing API key authentication
 */
export async function apiKeyAuthWorkflow() {
  // Assuming you have a knex instance
  const knex = {} as Knex; // Replace with your actual knex instance
  const reAuth = createApiKeyAuthExample(knex);

  try {
    // 1. First, register a user (API keys are for authenticated users)
    const registerResult = await reAuth.executeStep(
      'email-password',
      'register',
      {
        email: 'developer@example.com',
        password: 'StrongPassword123!',
      },
    );

    console.log('User registration result:', registerResult);

    if (registerResult.success) {
      // 2. Create an API key for the user
      const createKeyResult = await reAuth.executeStep(
        'api-key',
        'create-api-key',
        {
          entity: registerResult.entity,
          name: 'Development API Key',
          permissions: ['read', 'write'],
          expiresIn: 30 * 24 * 60 * 60 * 1000, // 30 days
        },
      );

      console.log('API key creation result:', createKeyResult);

      if (createKeyResult.success) {
        const apiKey = createKeyResult.apiKey;
        console.log('Generated API key:', apiKey);

        // 3. Authenticate using the API key
        const authResult = await reAuth.executeStep('api-key', 'authenticate', {
          apiKey,
        });

        console.log('API key authentication result:', authResult);

        if (authResult.success) {
          // 4. List all API keys for the user
          const listResult = await reAuth.executeStep(
            'api-key',
            'list-api-keys',
            {
              entity: authResult.entity,
            },
          );

          console.log('API keys list:', listResult);

          // 5. Revoke an API key
          const revokeResult = await reAuth.executeStep(
            'api-key',
            'revoke-api-key',
            {
              entity: authResult.entity,
              keyName: 'Development API Key',
            },
          );

          console.log('API key revocation result:', revokeResult);
        }
      }
    }
  } catch (error) {
    console.error('Error in API key auth workflow:', error);
  }
}

/**
 * Example: Using API key auth with Express.js
 */
export function createExpressApiKeyRoutes(reAuth: any) {
  const express = require('express');
  const router = express.Router();

  // Middleware to authenticate API key
  const authenticateApiKey = async (req: any, res: any, next: any) => {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;

    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    try {
      const result = await reAuth.executeStep('api-key', 'authenticate', {
        apiKey,
      });

      if (result.success) {
        req.user = result.entity;
        next();
      } else {
        res.status(401).json({ error: result.message });
      }
    } catch (error) {
      res.status(500).json({ error: 'Authentication failed' });
    }
  };

  // Create API key endpoint (requires user authentication)
  router.post('/api-keys', async (req: any, res: any) => {
    try {
      const { name, permissions, expiresIn } = req.body;
      const user = req.user; // From auth middleware

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const result = await reAuth.executeStep('api-key', 'create-api-key', {
        entity: user,
        name,
        permissions,
        expiresIn,
      });

      if (result.success) {
        res.status(201).json({
          message: result.message,
          apiKey: result.apiKey,
          keyData: result.keyData,
        });
      } else {
        res.status(400).json({
          error: result.message,
        });
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // List API keys endpoint
  router.get('/api-keys', async (req: any, res: any) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const result = await reAuth.executeStep('api-key', 'list-api-keys', {
        entity: user,
      });

      if (result.success) {
        res.json({
          message: result.message,
          apiKeys: result.apiKeys,
        });
      } else {
        res.status(400).json({
          error: result.message,
        });
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Revoke API key endpoint
  router.delete('/api-keys/:keyName', async (req: any, res: any) => {
    try {
      const { keyName } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const result = await reAuth.executeStep('api-key', 'revoke-api-key', {
        entity: user,
        keyName,
      });

      if (result.success) {
        res.json({
          message: result.message,
        });
      } else {
        res.status(400).json({
          error: result.message,
        });
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Protected API endpoint example
  router.get('/protected-data', authenticateApiKey, (req: any, res: any) => {
    res.json({
      message: 'This is protected data',
      user: req.user,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

/**
 * Frontend usage example for API key management
 */
export const useApiKeyManagement = () => {
  const createApiKey = async (
    name: string,
    permissions: string[],
    expiresIn?: number,
  ) => {
    const response = await fetch('/auth/api-keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Include session token for user authentication
        Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
      },
      body: JSON.stringify({ name, permissions, expiresIn }),
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, apiKey: data.apiKey, keyData: data.keyData };
    } else {
      const error = await response.json();
      return { success: false, error: error.error };
    }
  };

  const listApiKeys = async () => {
    const response = await fetch('/auth/api-keys', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, apiKeys: data.apiKeys };
    } else {
      const error = await response.json();
      return { success: false, error: error.error };
    }
  };

  const revokeApiKey = async (keyName: string) => {
    const response = await fetch(`/auth/api-keys/${keyName}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, message: data.message };
    } else {
      const error = await response.json();
      return { success: false, error: error.error };
    }
  };

  const callProtectedApi = async (apiKey: string, endpoint: string) => {
    const response = await fetch(endpoint, {
      headers: {
        'X-API-Key': apiKey,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    } else {
      const error = await response.json();
      return { success: false, error: error.error };
    }
  };

  return { createApiKey, listApiKeys, revokeApiKey, callProtectedApi };
};

/**
 * Node.js SDK example for API consumers
 */
export class ApiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://api.example.com') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async getData() {
    return this.makeRequest('/protected-data');
  }

  async postData(data: any) {
    return this.makeRequest('/protected-data', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

// Usage example:
// const client = new ApiClient('ak_your_api_key_here');
// client.getData().then(console.log).catch(console.error);
