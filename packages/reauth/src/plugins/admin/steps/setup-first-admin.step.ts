import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  type Token,
  tokenType,
} from '../../../types';
import type { AdminConfig } from '../types';
import { ReAuthEngine } from '../../../engine';
import { baseEmailPasswordPlugin } from '../../email-password';
import { baseUsernamePasswordPlugin } from '../../username';
import { baseEmailOrUsernamePlugin } from '../../email-or-username';

export interface SetupFirstAdminInput {
  email?: string;
  username?: string;
  password: string;
  setupKey?: string; // Optional setup key for additional security
  adminRole?: string; // Role to assign to the first admin
  metadata?: Record<string, any>;
}

export const setupFirstAdminValidation = type({
  'email?': 'string',
  'username?': 'string',
  password: 'string',
  'setupKey?': 'string',
  'adminRole?': 'string',
  'metadata?': 'object',
});

export interface SetupFirstAdminOutput extends AuthOutput {
  adminCreated?: boolean;
  adminId?: string;
  adminRole?: string;
  token?: Token;
}

export const setupFirstAdminStep: AuthStep<
  AdminConfig,
  'setup-first-admin',
  SetupFirstAdminInput,
  SetupFirstAdminOutput
> = {
  name: 'setup-first-admin',
  description: 'Set up the first admin user (only works when no admins exist)',
  validationSchema: setupFirstAdminValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { ic: 400, su: 201, aut: 403 },
      auth: false, // No auth required for first admin setup
    },
  },
  inputs: [
    'email',
    'username',
    'password',
    'setupKey',
    'adminRole',
    'metadata',
  ],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'adminCreated?': 'boolean',
    'adminId?': 'string',
    'adminRole?': 'string',
    'token?': tokenType,
  }),
  async run(input, ctx) {
    const {
      email,
      username,
      password,
      setupKey,
      adminRole = 'admin',
      metadata,
    } = input;

    // Check if first admin setup is enabled
    if (!ctx.config?.allowFirstAdminSetup) {
      return {
        success: false,
        message: 'First admin setup is not enabled',
        status: 'aut',
        error: 'First admin setup disabled',
      };
    }

    // Verify setup key if configured
    if (
      ctx.config?.firstAdminSetupKey &&
      setupKey !== ctx.config.firstAdminSetupKey
    ) {
      return {
        success: false,
        message: 'Invalid setup key',
        status: 'aut',
        error: 'Setup key required and invalid',
      };
    }

    const engine = ctx.engine as ReAuthEngine<
      [
        typeof baseEmailPasswordPlugin,
        typeof baseUsernamePasswordPlugin,
        typeof baseEmailOrUsernamePlugin,
      ]
    >;

    const orm = await engine.getOrm();

    try {
      // Check if any admin users already exist
      const existingAdmins = await orm.findMany('subject_roles', {
        where: (b: any) => b('role', '=', adminRole),
        limit: 1,
      });

      if (existingAdmins && existingAdmins.length > 0) {
        return {
          success: false,
          message: 'Admin users already exist. Cannot create first admin.',
          status: 'aut',
          error: 'First admin already exists',
        };
      }

      // Validate input - require either email or username
      if (!email && !username) {
        return {
          success: false,
          message: 'Either email or username is required',
          status: 'ic',
          error: 'Missing required fields',
        };
      }

      // Validate password strength
      if (password.length < 8) {
        return {
          success: false,
          message: 'Password must be at least 8 characters long',
          status: 'ic',
          error: 'Password too short',
        };
      }

      let userId: string;
      let userIdentifier: string;

      // Create the user based on the provided identifier
      if (email) {
        // Use email-password plugin
        const emailPlugin = engine.getPlugin('email-password');
        if (!emailPlugin) {
          throw new Error('Email-password plugin not configured');
        }

        const result = await engine.executeStep('email-password', 'register', {
          email,
          password,
        });

        if (!result.success) {
          return {
            success: false,
            message: 'Failed to create admin user',
            status: 'ic',
            error: result.error,
          };
        }

        userId = result.subject.id!;
        userIdentifier = email;
      } else if (username) {
        // Use username-password plugin
        const usernamePlugin = engine.getPlugin('username-password');
        if (!usernamePlugin) {
          throw new Error('Username-password plugin not configured');
        }

        const result = await engine.executeStep(
          'username-password',
          'register',
          {
            username,
            password,
          },
        );

        if (!result.success) {
          return {
            success: false,
            message: 'Failed to create admin user',
            status: 'ic',
            error: result.error,
          };
        }

        userId = result.subject.id!;
        userIdentifier = username;
      } else {
        throw new Error('Invalid user creation parameters');
      }

      // Assign admin role
      const roleRecord = await orm.create('subject_roles', {
        subject_id: userId,
        role: adminRole,
        permissions: JSON.stringify(
          ctx.config?.customPermissions?.[adminRole] || [],
        ),
        assigned_by: userId, // Self-assigned for first admin
        assigned_at: new Date(),
        expires_at: null, // No expiration for first admin
        metadata: metadata ? JSON.stringify(metadata) : null,
      });

      // Log the admin creation
      if (ctx.config?.enableAuditLogging) {
        await orm.create('audit_logs', {
          actor_id: userId,
          action: 'setup_first_admin',
          target_type: 'subject',
          target_id: userId,
          details: JSON.stringify({
            userIdentifier,
            adminRole,
            metadata,
            setupKey: setupKey ? 'provided' : 'none',
          }),
          ip_address: null,
          user_agent: null,
          created_at: new Date(),
        });
      }

      // Create a session for the new admin
      const ttl = ctx.config?.maxAdminSessionDuration || 3600; // 1 hour default
      const token = await engine.createSessionFor('subject', userId, ttl);

      return {
        success: true,
        message: `First admin user created successfully with ${userIdentifier}`,
        status: 'su',
        adminCreated: true,
        adminId: userId,
        adminRole,
        token,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create first admin user',
        status: 'ic',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};
