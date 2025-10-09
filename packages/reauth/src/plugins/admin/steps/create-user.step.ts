import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  type Token,
  tokenType,
} from '../../../types';
import type { AdminConfig } from '../types';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';
import { ReAuthEngine } from '../../../engine';
import { baseUsernamePasswordPlugin } from '../../username';
import { baseEmailPasswordPlugin } from '../../email-password';

export type CreateUserInput = {
  token: Token;
  email?: string;
  username?: string;
  password: string;
  roles?: string[];
  sendWelcomeEmail?: boolean;
  skipVerification?: boolean;
  metadata?: Record<string, any>;
};

export const createUserValidation = type({
  token: tokenType,
  'email?': 'string',
  'username?': 'string',
  password: 'string',
  'roles?': 'string[]',
  'sendWelcomeEmail?': 'boolean',
  'skipVerification?': 'boolean',
  'metadata?': 'object',
});

export const createUserStep: AuthStep<
  AdminConfig,
  'create-user',
  CreateUserInput,
  AuthOutput
> = {
  name: 'create-user',
  description: 'Create a new user account (admin only)',
  validationSchema: createUserValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { unf: 401, aut: 403, su: 201, ic: 400, nf: 404 },
      auth: true,
    },
  },
  inputs: [
    'token',
    'email',
    'username',
    'password',
    'roles',
    'sendWelcomeEmail',
    'skipVerification',
    'metadata',
  ],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'error?': 'string | object',
    'userId?': 'string',
    'emailSent?': 'boolean',
    'token?': tokenType,
  }),
  async run(input, ctx) {
    const {
      token,
      email,
      username,
      password,
      roles = [],
      sendWelcomeEmail = true,
      skipVerification = false,
      metadata,
    } = input;

    const engine = ctx.engine as ReAuthEngine<
      [typeof baseEmailPasswordPlugin, typeof baseUsernamePasswordPlugin]
    >;

    const check = await engine.checkSession(token);

    if (!check.valid || !check.subject?.id) {
      return {
        success: false,
        message: 'Authentication required',
        status: 'unf',
      };
    }

    const subjectId = check.subject.id as string;
    const orm = await engine.getOrm();

    // Check admin permissions
    const adminRole = await orm.findFirst('subject_roles', {
      where: (b: any) =>
        b.and(
          b('subject_id', '=', subjectId),
          b('role', '=', ctx.config?.adminRole || 'admin'),
          b.or(b('expires_at', '=', null), b('expires_at', '>', new Date())),
        ),
    });

    if (!adminRole) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Admin access required',
          status: 'aut',
          error: 'Insufficient permissions',
        },
        token,
        check.token,
      );
    }

    // Validate input
    if (!email && !username) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Either email or username is required',
          status: 'ic',
          error: 'Missing required fields',
        },
        token,
        check.token,
      );
    }

    try {
      // Create the user via appropriate plugin
      let userId: string;
      let emailSent = false;
      //TODO: fix skip verification

      if (email && !username) {
        // Use email-password plugin
        const emailPlugin = engine.getPlugin('email-password');
        if (!emailPlugin) {
          throw new Error('Email-password plugin not configured');
        }

        // Create user through email-password registration
        const result = await engine.executeStep('email-password', 'register', {
          email,
          password,
        });

        if (!result.success) {
          return attachNewTokenIfDifferent(
            {
              success: false,
              message: 'Failed to create user',
              status: 'ic',
              error: result.error,
            },
            token,
            check.token,
          );
        }

        userId = result.subject.id!;

        // Send welcome email if requested
        if (sendWelcomeEmail && !skipVerification) {
          //TODO: fix
          emailSent = true;
        }
      } else if (username) {
        // Use username plugin
        const usernamePlugin = engine.getPlugin('username-password');
        if (!usernamePlugin) {
          throw new Error('Username-password plugin not configured');
        }

        const result = await engine.executeStep(
          'username-password',
          'register',
          {
            username,
            password: password || '',
          },
        );

        if (!result.success) {
          return attachNewTokenIfDifferent(
            {
              success: false,
              message: 'Failed to create user',
              status: 'ic',
              error: result.error,
            },
            token,
            check.token,
          );
        }

        userId = result.subject.id!;
      } else {
        throw new Error('Invalid user creation parameters');
      }

      // Assign roles if specified
      if (roles.length > 0) {
        for (const role of roles) {
          await orm.create('subject_roles', {
            subject_id: userId,
            role,
            permissions: ctx.config?.customPermissions?.[role] || [],
            assigned_by: subjectId,
            assigned_at: new Date(),
          });
        }
      }

      // Add metadata if provided
      if (metadata) {
        await orm.updateMany('subjects', {
          where: (b: any) => b('id', '=', userId),
          set: { metadata: JSON.stringify(metadata) },
        });
      }

      // Log the admin action
      if (ctx.config?.enableAuditLogging) {
        await orm.create('audit_logs', {
          actor_id: subjectId,
          action: 'create_user',
          target_type: 'subject',
          target_id: userId,
          details: JSON.stringify({
            email,
            username,
            roles,
            sendWelcomeEmail,
            skipVerification,
          }),
          ip_address: null,
          user_agent: null,
          created_at: new Date(),
        });
      }

      return attachNewTokenIfDifferent(
        {
          success: true,
          message: `User created successfully with ID: ${userId}`,
          status: 'su',
          userId,
          emailSent,
        },
        token,
        check.token,
      );
    } catch (error) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Failed to create user',
          status: 'ic',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        token,
        check.token,
      );
    }
  },
};
