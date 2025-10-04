import { type } from 'arktype';
import { tokenType, type AuthStep } from '../../../types';
import type {
  SetRolesPermissionsInput,
  SetRolesPermissionsOutput,
  OrganizationConfig,
} from '../types';
import { hasOrganizationPermission } from '../utils';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export const setRolesPermissionsValidation = type({
  token: tokenType,
  organization_id: 'string',
  'subject_id?': 'string',
  'email?': 'string',
  'roles?': ['string'],
  'permissions?': ['string'],
  'remove_roles?': ['string'],
  'remove_permissions?': ['string'],
});

export const setRolesPermissionsStep: AuthStep<
  OrganizationConfig,
  'set-roles-permissions',
  SetRolesPermissionsInput,
  SetRolesPermissionsOutput
> = {
  name: 'set-roles-permissions',
  description:
    'Set or remove roles and permissions for organization members (requires admin role)',
  validationSchema: setRolesPermissionsValidation,
  protocol: {
    http: {
      method: 'PUT',
      codes: { su: 200, ip: 401, ic: 400, unf: 404 },
      auth: true,
    },
  },
  inputs: [
    'token',
    'organization_id',
    'subject_id',
    'email',
    'roles',
    'permissions',
    'remove_roles',
    'remove_permissions',
  ],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'membership?': {
      id: 'string',
      subject_id: 'string',
      organization_id: 'string',
      roles: ['string'],
      permissions: ['string'],
      updated_at: 'string',
    },
    'token?': tokenType,
  }),
  async run(input, ctx) {
    const {
      token,
      organization_id,
      subject_id,
      email,
      roles = [],
      permissions = [],
      remove_roles = [],
      remove_permissions = [],
    } = input;
    const orm = await ctx.engine.getOrm();

    // Verify authentication
    const session = await ctx.engine.checkSession(token);
    if (!session.valid || !session.subject) {
      return {
        success: false,
        message: 'Authentication required',
        status: 'ip',
      };
    }

    const requestorId = session.subject.id;

    // Validate that either subject_id or email is provided
    if (!subject_id && !email) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Either subject_id or email must be provided',
          status: 'ic',
        },
        token,
        session.token,
      );
    }

    // Get email if needed
    let targetEmail = email;
    if (
      email &&
      !subject_id &&
      !ctx.config.useEmailPlugin &&
      ctx.config.getEmail
    ) {
      try {
        targetEmail = await ctx.config.getEmail(email);
      } catch (error) {
        return attachNewTokenIfDifferent(
          {
            success: false,
            message: 'Failed to retrieve email for subject',
            status: 'ic',
          },
          token,
          session.token,
        );
      }
    }

    // Check if organization exists
    const organization = await orm.findFirst('organizations', {
      where: (b: any) =>
        b.and(b('id', '=', organization_id), b('is_active', '=', true)),
    });

    if (!organization) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Organization not found',
          status: 'unf',
        },
        token,
        session.token,
      );
    }

    // Check admin permission
    const hasPermission = await hasOrganizationPermission(
      requestorId,
      organization_id,
      'admin',
      orm,
    );
    if (!hasPermission) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Admin access required to manage roles and permissions',
          status: 'unf',
        },
        token,
        session.token,
      );
    }

    // Find the membership to update
    const membership = await orm.findFirst('organization_memberships', {
      where: (b: any) =>
        b.and(
          b('organization_id', '=', organization_id),
          subject_id
            ? b('subject_id', '=', subject_id)
            : b('email', '=', targetEmail),
          b('status', '=', 'active'),
        ),
    });

    if (!membership) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'User is not a member of this organization',
          status: 'unf',
        },
        token,
        session.token,
      );
    }

    try {
      const now = new Date();

      // Get current roles and permissions
      const currentRoles = membership.roles
        ? String(membership.roles)
            .split(',')
            .filter((r) => r.trim())
        : [];
      const currentPermissions = membership.permissions
        ? String(membership.permissions)
            .split(',')
            .filter((p) => p.trim())
        : [];

      // Calculate new roles and permissions
      let newRoles = [...currentRoles];
      let newPermissions = [...currentPermissions];

      // Add new roles (avoid duplicates)
      for (const role of roles) {
        if (!newRoles.includes(role)) {
          newRoles.push(role);
        }
      }

      // Add new permissions (avoid duplicates)
      for (const permission of permissions) {
        if (!newPermissions.includes(permission)) {
          newPermissions.push(permission);
        }
      }

      // Remove specified roles
      newRoles = newRoles.filter((role) => !remove_roles.includes(role));

      // Remove specified permissions
      newPermissions = newPermissions.filter(
        (permission) => !remove_permissions.includes(permission),
      );

      // Update membership
      await orm.updateMany('organization_memberships', {
        where: (b: any) =>
          b.and(
            b('organization_id', '=', organization_id),
            b('id', '=', membership.id),
          ),
        set: {
          roles: newRoles.join(','),
          permissions: newPermissions.join(','),
          updated_at: now,
        },
      });

      return attachNewTokenIfDifferent(
        {
          success: true,
          message: 'Roles and permissions updated successfully',
          status: 'su',
          membership: {
            id: membership.id as string,
            subject_id: membership.subject_id as string,
            organization_id: membership.organization_id as string,
            roles: newRoles,
            permissions: newPermissions,
            updated_at: now.toISOString(),
          },
        },
        token,
        session.token,
      );
    } catch (error) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Failed to update roles and permissions',
          status: 'ic',
        },
        token,
        session.token,
      );
    }
  },
};
