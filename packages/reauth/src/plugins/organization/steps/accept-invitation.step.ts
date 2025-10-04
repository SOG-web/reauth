import { type } from 'arktype';
import { tokenType, type AuthStep } from '../../../types';
import type {
  AcceptInvitationInput,
  AcceptInvitationOutput,
  OrganizationConfig,
} from '../types';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export const acceptInvitationValidation = type({
  'invitation_token?': 'string', // invitation
  'token?': tokenType, // authentication
});

export const acceptInvitationStep: AuthStep<
  OrganizationConfig,
  'accept-invitation',
  AcceptInvitationInput,
  AcceptInvitationOutput
> = {
  name: 'accept-invitation',
  description: 'Accept organization invitation',
  validationSchema: acceptInvitationValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ip: 401, ic: 400, unf: 404, eq: 409 },
      auth: true,
    },
  },
  inputs: ['invitation_token', 'token'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'membership?': {
      id: 'string',
      organization_id: 'string',
      role: 'string',
    },
    'token?': tokenType,
  }),
  async run(input, ctx) {
    const { invitation_token, token } = input;
    const orm = await ctx.engine.getOrm();

    let subjectId: string | null = null;

    const session = await ctx.engine.checkSession(token);
    if (!session.valid || !session.subject) {
      return {
        success: false,
        message: 'Authentication required',
        status: 'ip',
      };
    }

    subjectId = session.subject.id as string;

    if (!subjectId) {
      return {
        success: false,
        message:
          'User account not found. Please register or authenticate first.',
        status: 'ip',
      };
    }

    // Find the invitation
    const invitation = await orm.findFirst('organization_invitations', {
      where: (b: any) => b('token', '=', invitation_token),
    });

    if (!invitation) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Invalid invitation token',
          status: 'unf',
        },
        token,
        session.token,
      );
    }

    // Check if invitation is still valid
    if (invitation.status !== 'pending') {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: `Invitation is ${invitation.status}`,
          status: 'ic',
        },
        token,
        session.token,
      );
    }

    // Check if invitation has expired
    const now = new Date();
    if (new Date(invitation.expires_at as any) < now) {
      // Update invitation status to expired
      await orm.updateMany('organization_invitations', {
        where: (b: any) => b('id', '=', invitation.id),
        set: {
          status: 'expired',
          updated_at: now,
        },
      });

      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Invitation has expired',
          status: 'ic',
        },
        token,
        session.token,
      );
    }

    // Check if organization still exists and is active
    const organization = await orm.findFirst('organizations', {
      where: (b: any) =>
        b.and(
          b('id', '=', invitation.organization_id),
          b('is_active', '=', true),
        ),
    });

    if (!organization) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Organization no longer exists',
          status: 'unf',
        },
        token,
        session.token,
      );
    }

    // Check if user is already a member
    const existingMembership = await orm.findFirst('organization_memberships', {
      where: (b: any) =>
        b.and(
          b('subject_id', '=', subjectId),
          b('organization_id', '=', invitation.organization_id),
          b('email', '=', invitation.email),
          b('status', 'in', ['active', 'pending']),
        ),
    });

    if (existingMembership) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'User is already a member of this organization',
          status: 'eq',
        },
        token,
        session.token,
      );
    }

    try {
      // Create membership
      const membership = await orm.create('organization_memberships', {
        subject_id: subjectId,
        organization_id: invitation.organization_id,
        role: invitation.role,
        roles: '',
        permissions: '',
        email: invitation.email,
        invited_by: invitation.invited_by,
        joined_at: now,
        expires_at: null,
        status: 'active',
        created_at: now,
        updated_at: now,
      });

      // Update invitation status
      await orm.updateMany('organization_invitations', {
        where: (b: any) => b('id', '=', invitation.id),
        set: {
          status: 'accepted',
          accepted_at: now,
          updated_at: now,
        },
      });

      return attachNewTokenIfDifferent(
        {
          success: true,
          message: 'Successfully joined organization',
          status: 'su',
          membership: {
            id: membership.id as string,
            organization_id: invitation.organization_id as string,
            role: invitation.role as string,
          },
        },
        token,
        session.token,
      );
    } catch (error) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Failed to accept invitation',
          status: 'ic',
        },
        token,
        session.token,
      );
    }
  },
};
