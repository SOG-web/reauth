import { type } from 'arktype';
import type { AuthStepV2 } from '../../../types.v2';
import type { AcceptInvitationInput, AcceptInvitationOutput, OrganizationConfigV2 } from '../types';

export const acceptInvitationValidation = type({
  token: 'string', // invitation token
  'user_token?': 'string', // optional user authentication token
});

export const acceptInvitationStep: AuthStepV2<
  AcceptInvitationInput,
  AcceptInvitationOutput,
  OrganizationConfigV2
> = {
  name: 'accept-invitation',
  description: 'Accept organization invitation',
  validationSchema: acceptInvitationValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ip: 401, ic: 400, unf: 404, eq: 409 },
    },
  },
  inputs: ['token', 'user_token'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'membership?': {
      id: 'string',
      organization_id: 'string',
      role: 'string',
    },
  }),
  async run(input, ctx) {
    const { token, user_token } = input;
    const orm = await ctx.engine.getOrm();

    // Find the invitation
    const invitation = await orm.findFirst('organization_invitations', {
      where: (b: any) => b('token', '=', token),
    });

    if (!invitation) {
      return {
        success: false,
        message: 'Invalid invitation token',
        status: 'unf',
      };
    }

    // Check if invitation is still valid
    if (invitation.status !== 'pending') {
      return {
        success: false,
        message: `Invitation is ${invitation.status}`,
        status: 'ic',
      };
    }

    // Check if invitation has expired
    const now = new Date();
    if (new Date(invitation.expires_at) < now) {
      // Update invitation status to expired
      await orm.updateMany('organization_invitations', {
        where: (b: any) => b('id', '=', invitation.id),
        set: {
          status: 'expired',
          updated_at: now,
        },
      });

      return {
        success: false,
        message: 'Invitation has expired',
        status: 'ic',
      };
    }

    // Check if organization still exists and is active
    const organization = await orm.findFirst('organizations', {
      where: (b: any) =>
        b.and(
          b('id', '=', invitation.organization_id),
          b('is_active', '=', true)
        ),
    });

    if (!organization) {
      return {
        success: false,
        message: 'Organization no longer exists',
        status: 'unf',
      };
    }

    let subjectId: string;

    if (user_token) {
      // User is already authenticated, verify their session
      const session = await ctx.engine.checkSession(user_token);
      if (!session.valid || !session.subject) {
        return {
          success: false,
          message: 'Invalid user authentication',
          status: 'ip',
        };
      }
      subjectId = session.subject.id;

      // Verify the invitation email matches the authenticated user's email
      const userIdentity = await orm.findFirst('identities', {
        where: (b: any) =>
          b.and(
            b('subject_id', '=', subjectId),
            b('provider', '=', 'email'),
            b('identifier', '=', invitation.email)
          ),
      });

      if (!userIdentity) {
        return {
          success: false,
          message: 'Invitation email does not match authenticated user',
          status: 'ic',
        };
      }
    } else {
      // No user token provided - find user by email or create if needed
      const existingIdentity = await orm.findFirst('identities', {
        where: (b: any) =>
          b.and(
            b('provider', '=', 'email'),
            b('identifier', '=', invitation.email)
          ),
      });

      if (existingIdentity) {
        subjectId = existingIdentity.subject_id;
      } else {
        // In a real implementation, you might want to require the user to register first
        // For now, we'll return an error requiring authentication
        return {
          success: false,
          message: 'User account not found. Please register or authenticate first.',
          status: 'ip',
        };
      }
    }

    // Check if user is already a member
    const existingMembership = await orm.findFirst('organization_memberships', {
      where: (b: any) =>
        b.and(
          b('subject_id', '=', subjectId),
          b('organization_id', '=', invitation.organization_id),
          b('status', 'in', ['active', 'pending'])
        ),
    });

    if (existingMembership) {
      return {
        success: false,
        message: 'User is already a member of this organization',
        status: 'eq',
      };
    }

    try {
      const membershipId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      
      // Create membership
      await orm.insertOne('organization_memberships', {
        id: membershipId,
        subject_id: subjectId,
        organization_id: invitation.organization_id,
        role: invitation.role,
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

      return {
        success: true,
        message: 'Successfully joined organization',
        status: 'su',
        membership: {
          id: membershipId,
          organization_id: invitation.organization_id,
          role: invitation.role,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to accept invitation',
        status: 'ic',
      };
    }
  },
};