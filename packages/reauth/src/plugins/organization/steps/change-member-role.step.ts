import { type } from 'arktype';
import type { AuthStep } from '../../../types';
import type {
  ChangeMemberRoleInput,
  ChangeMemberRoleOutput,
  OrganizationConfig,
} from '../types';
import { hasOrganizationPermission, isValidRole } from '../utils';

export const changeMemberRoleValidation = type({
  token: 'string',
  organization_id: 'string',
  'subject_id?': 'string',
  'email?': 'string',
  role: 'string',
});

export const changeMemberRoleStep: AuthStep<
  OrganizationConfig,
  ChangeMemberRoleInput,
  ChangeMemberRoleOutput
> = {
  name: 'change-member-role',
  description: 'Update member role in organization (requires admin role)',
  validationSchema: changeMemberRoleValidation,
  protocol: {
    http: {
      method: 'PUT',
      codes: { su: 200, ip: 401, ic: 400, unf: 404 },
      auth: true,
    },
  },
  inputs: ['token', 'organization_id', 'subject_id', 'email', 'role'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'membership?': {
      id: 'string',
      subject_id: 'string',
      organization_id: 'string',
      role: 'string',
      updated_at: 'string',
    },
  }),
  async run(input, ctx) {
    const { token, organization_id, subject_id, email, role } = input;
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

    // Validate role
    if (!isValidRole(role, ctx.config)) {
      return {
        success: false,
        message: `Invalid role. Available roles: ${ctx.config?.availableRoles?.join(', ') || 'admin, member, viewer'}`,
        status: 'ic',
      };
    }

    // Check if organization exists
    const organization = await orm.findFirst('organizations', {
      where: (b: any) =>
        b.and(b('id', '=', organization_id), b('is_active', '=', true)),
    });

    if (!organization) {
      return {
        success: false,
        message: 'Organization not found',
        status: 'unf',
      };
    }

    // Check admin permission
    const hasPermission = await hasOrganizationPermission(
      requestorId,
      organization_id,
      'admin',
      orm,
    );
    if (!hasPermission) {
      return {
        success: false,
        message: 'Admin access required to change member roles',
        status: 'unf',
      };
    }

    // Check if target user is a member
    const membership = await orm.findFirst('organization_memberships', {
      where: (b: any) =>
        b.and(
          b('subject_id', '=', subject_id),
          b('email', '=', email),
          b('organization_id', '=', organization_id),
          b('status', '=', 'active'),
        ),
    });

    if (!membership) {
      return {
        success: false,
        message: 'User is not a member of this organization',
        status: 'unf',
      };
    }

    // Prevent removing admin role from the last admin
    if (membership.role === 'admin' && role !== 'admin') {
      const adminCount = await orm.count('organization_memberships', {
        where: (b: any) =>
          b.and(
            b('organization_id', '=', organization_id),
            b('role', '=', 'admin'),
            b('status', '=', 'active'),
          ),
      });

      const adminCountNumber = typeof adminCount === 'number' ? adminCount : 0;
      if (adminCountNumber <= 1) {
        return {
          success: false,
          message: 'Cannot remove admin role from the last admin',
          status: 'ic',
        };
      }
    }

    // Check if role is already the same
    if (membership.role === role) {
      return {
        success: false,
        message: 'User already has this role',
        status: 'ic',
      };
    }

    try {
      const now = new Date();

      // Update membership role
      await orm.updateMany('organization_memberships', {
        where: (b: any) =>
          b.and(
            b('subject_id', '=', subject_id),
            b('organization_id', '=', organization_id),
          ),
        set: {
          role,
          updated_at: now,
        },
      });

      return {
        success: true,
        message: 'Member role updated successfully',
        status: 'su',
        membership: {
          id: membership.id as string,
          subject_id: membership.subject_id as string,
          organization_id: membership.organization_id as string,
          role,
          updated_at: now.toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update member role',
        status: 'ic',
      };
    }
  },
};
