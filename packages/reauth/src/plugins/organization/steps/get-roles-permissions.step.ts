import { type } from 'arktype';
import { tokenType, type AuthStep } from '../../../types';
import type {
  GetRolesPermissionsInput,
  GetRolesPermissionsOutput,
  OrganizationConfig,
} from '../types';
import { hasOrganizationPermission } from '../utils';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export const getRolesPermissionsValidation = type({
  token: tokenType,
  organization_id: 'string',
  'subject_id?': 'string',
  'email?': 'string',
});

export const getRolesPermissionsStep: AuthStep<
  OrganizationConfig,
  GetRolesPermissionsInput,
  GetRolesPermissionsOutput
> = {
  name: 'get-roles-permissions',
  description:
    'Get roles and permissions for organization members (requires admin role)',
  validationSchema: getRolesPermissionsValidation,
  protocol: {
    http: {
      method: 'GET',
      codes: { su: 200, ip: 401, ic: 400, unf: 404 },
      auth: true,
    },
  },
  inputs: ['token', 'organization_id', 'subject_id', 'email'],
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
      role: 'string',
      email: 'string',
    },
    'token?': tokenType,
  }),
  async run(input, ctx) {
    const { token, organization_id, subject_id, email } = input;
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
          message: 'Admin access required to view member roles and permissions',
          status: 'unf',
        },
        token,
        session.token,
      );
    }

    // Find the membership to retrieve
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
      // Parse roles and permissions
      const roles = membership.roles
        ? String(membership.roles)
            .split(',')
            .filter((r) => r.trim())
        : [];
      const permissions = membership.permissions
        ? String(membership.permissions)
            .split(',')
            .filter((p) => p.trim())
        : [];

      return attachNewTokenIfDifferent(
        {
          success: true,
          message: 'Roles and permissions retrieved successfully',
          status: 'su',
          membership: {
            id: membership.id as string,
            subject_id: membership.subject_id as string,
            organization_id: membership.organization_id as string,
            roles,
            permissions,
            role: membership.role as string,
            email: membership.email as string,
          },
        },
        token,
        session.token,
      );
    } catch (error) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Failed to retrieve roles and permissions',
          status: 'ic',
        },
        token,
        session.token,
      );
    }
  },
};
