import { Knex } from 'knex';
import { createReAuthEngine } from '../../auth-engine';
import { KnexEntityService, KnexSessionService } from '../../services';
import usernamePasswordAuth from './username.plugin';

/**
 * Example: Creating ReAuth engine with username/password authentication
 */
export function createUsernameAuthExample(knex: Knex) {
  const entityService = new KnexEntityService(knex, 'entities');
  const sessionService = new KnexSessionService(knex, 'sessions');

  const reAuth = createReAuthEngine({
    plugins: [
      usernamePasswordAuth({
        loginOnRegister: true, // Automatically login after registration
      }),
    ],
    entity: entityService,
    session: sessionService,
  });

  return reAuth;
}

/**
 * Example workflow showing username authentication
 */
export async function usernameAuthWorkflow() {
  // Assuming you have a knex instance
  const knex = {} as Knex; // Replace with your actual knex instance
  const reAuth = createUsernameAuthExample(knex);

  try {
    // 1. Register a new user with username and password
    const registerResult = await reAuth.executeStep('username-password', 'register', {
      username: 'john_doe',
      password: 'StrongPassword123!',
    });

    console.log('Registration result:', registerResult);

    if (registerResult.success) {
      console.log('User registered successfully with token:', registerResult.token);
      console.log('User entity:', registerResult.entity);
    }

    // 2. Login with username and password
    const loginResult = await reAuth.executeStep('username-password', 'login', {
      username: 'john_doe',
      password: 'StrongPassword123!',
    });

    console.log('Login result:', loginResult);

    if (loginResult.success) {
      console.log('User logged in successfully with token:', loginResult.token);
      
      // 3. Change password (requires authentication)
      const changePasswordResult = await reAuth.executeStep('username-password', 'change-password', {
        entity: loginResult.entity,
        currentPassword: 'StrongPassword123!',
        newPassword: 'NewStrongPassword456!',
      });

      console.log('Change password result:', changePasswordResult);
    }

  } catch (error) {
    console.error('Error in username auth workflow:', error);
  }
}

/**
 * Example: Using username auth with Express.js
 */
export function createExpressUsernameRoutes(reAuth: any) {
  const express = require('express');
  const router = express.Router();

  // Register endpoint
  router.post('/register', async (req: any, res: any) => {
    try {
      const { username, password } = req.body;
      
      const result = await reAuth.executeStep('username-password', 'register', {
        username,
        password,
      });

      if (result.success) {
        // Set session cookie
        res.cookie('auth_token', result.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
        });
        
        res.status(201).json({
          message: result.message,
          user: result.entity,
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

  // Login endpoint
  router.post('/login', async (req: any, res: any) => {
    try {
      const { username, password } = req.body;
      
      const result = await reAuth.executeStep('username-password', 'login', {
        username,
        password,
      });

      if (result.success) {
        res.cookie('auth_token', result.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 24 * 60 * 60 * 1000,
        });
        
        res.json({
          message: result.message,
          user: result.entity,
        });
      } else {
        res.status(401).json({
          error: result.message,
        });
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Change password endpoint (requires authentication)
  router.post('/change-password', async (req: any, res: any) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = req.user; // Assuming you have auth middleware
      
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const result = await reAuth.executeStep('username-password', 'change-password', {
        entity: user,
        currentPassword,
        newPassword,
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

  return router;
}

/**
 * Frontend usage example (React)
 */
export const useUsernameAuth = () => {
  const register = async (username: string, password: string) => {
    const response = await fetch('/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, user: data.user, message: data.message };
    } else {
      const error = await response.json();
      return { success: false, error: error.error };
    }
  };

  const login = async (username: string, password: string) => {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, user: data.user, message: data.message };
    } else {
      const error = await response.json();
      return { success: false, error: error.error };
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const response = await fetch('/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, message: data.message };
    } else {
      const error = await response.json();
      return { success: false, error: error.error };
    }
  };

  return { register, login, changePassword };
}; 