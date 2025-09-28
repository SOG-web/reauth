import { type } from 'arktype';
import type { AuthStep } from '../../../types';
import type {
  InviteMemberInput,
  InviteMemberOutput,
  OrganizationConfig,
} from '../types';
import {
  generateInvitationToken,
  calculateInvitationExpiry,
  hasOrganizationPermission,
  isValidRole,
} from '../utils';

export const inviteMemberValidation = type({
  token: 'string',
  organization_id: 'string',
  email: 'string.email',
  role: 'string',
});

export const inviteMemberStep: AuthStep<
  OrganizationConfig,
  InviteMemberInput,
  InviteMemberOutput
> = {
  name: 'invite-member',
  description: 'Invite user to organization (requires admin role)',
  validationSchema: inviteMemberValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 201, ip: 401, ic: 400, eq: 409, unf: 403 },
      auth: true,
    },
  },
  inputs: ['token', 'organization_id', 'email', 'role'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'invitation?': {
      id: 'string',
      token: 'string',
      expires_at: 'string',
    },
  }),
  async run(input, ctx) {
    const { token, organization_id, email, role } = input;
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

    const subjectId = session.subject.id;

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
      subjectId,
      organization_id,
      'admin',
      orm,
    );
    if (!hasPermission) {
      return {
        success: false,
        message: 'Admin access required to invite members',
        status: 'unf',
      };
    }

    // Check if user is already a member
    const existingMembership = await orm.findFirst('organization_memberships', {
      where: (b: any) =>
        b.and(
          b('organization_id', '=', organization_id),
          b('email', '=', email),
          b('status', 'in', ['active', 'pending']),
        ),
    });

    if (existingMembership) {
      return {
        success: false,
        message: 'User is already a member of this organization',
        status: 'eq',
      };
    }

    // Check if there's already a pending invitation
    const existingInvitation = await orm.findFirst('organization_invitations', {
      where: (b: any) =>
        b.and(
          b('organization_id', '=', organization_id),
          b('email', '=', email),
          b('status', 'in', ['pending']),
        ),
    });

    if (existingInvitation) {
      return {
        success: false,
        message: 'Invitation already sent to this email',
        status: 'eq',
      };
    }

    try {
      const now = new Date();
      const invitationToken = generateInvitationToken();
      const expiresAt = calculateInvitationExpiry(ctx.config);

      const invitation = await orm.create('organization_invitations', {
        organization_id,
        email,
        role,
        roles: '',
        permissions: '',
        invited_by: subjectId,
        token: invitationToken,
        expires_at: expiresAt,
        accepted_at: null,
        status: 'pending',
        created_at: now,
        updated_at: now,
      });

      return {
        success: true,
        message: 'Invitation sent successfully',
        status: 'su',
        invitation: {
          id: invitation.id as string,
          token: invitationToken,
          expires_at: expiresAt.toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to send invitation',
        status: 'ic',
      };
    }
  },
};
