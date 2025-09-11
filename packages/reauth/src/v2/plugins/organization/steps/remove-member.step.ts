import { type } from 'arktype';
import type { AuthStepV2 } from '../../../types.v2';
import type { RemoveMemberInput, RemoveMemberOutput, OrganizationConfigV2 } from '../types';
import { hasOrganizationPermission } from '../utils';

export const removeMemberValidation = type({
  token: 'string',
  organization_id: 'string',
  subject_id: 'string',
});

export const removeMemberStep: AuthStepV2<
  RemoveMemberInput,
  RemoveMemberOutput,
  OrganizationConfigV2
> = {
  name: 'remove-member',
  description: 'Remove user from organization (requires admin role)',
  validationSchema: removeMemberValidation,
  protocol: {
    http: {
      method: 'DELETE',
      codes: { su: 200, ip: 401, ic: 400, unf: 404 },
      auth: true,
    },
  },
  inputs: ['token', 'organization_id', 'subject_id'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
  }),
  async run(input, ctx) {
    const { token, organization_id, subject_id } = input;
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

    // Check if organization exists
    const organization = await orm.findFirst('organizations', {
      where: (b: any) =>
        b.and(
          b('id', '=', organization_id),
          b('is_active', '=', true)
        ),
    });

    if (!organization) {
      return {
        success: false,
        message: 'Organization not found',
        status: 'unf',
      };
    }

    // Check admin permission
    const hasPermission = await hasOrganizationPermission(requestorId, organization_id, 'admin', orm);
    if (!hasPermission) {
      return {
        success: false,
        message: 'Admin access required to remove members',
        status: 'unf',
      };
    }

    // Prevent self-removal if user is the only admin
    if (requestorId === subject_id) {
      const adminCount = await orm.count('organization_memberships', {
        where: (b: any) =>
          b.and(
            b('organization_id', '=', organization_id),
            b('role', '=', 'admin'),
            b('status', '=', 'active')
          ),
      });

      const adminCountNumber = typeof adminCount === 'number' ? adminCount : 0;
      if (adminCountNumber <= 1) {
        return {
          success: false,
          message: 'Cannot remove the last admin from the organization',
          status: 'ic',
        };
      }
    }

    // Check if target user is a member
    const membership = await orm.findFirst('organization_memberships', {
      where: (b: any) =>
        b.and(
          b('subject_id', '=', subject_id),
          b('organization_id', '=', organization_id),
          b('status', '=', 'active')
        ),
    });

    if (!membership) {
      return {
        success: false,
        message: 'User is not a member of this organization',
        status: 'unf',
      };
    }

    try {
      // Remove membership
      await orm.deleteMany('organization_memberships', {
        where: (b: any) =>
          b.and(
            b('subject_id', '=', subject_id),
            b('organization_id', '=', organization_id)
          ),
      });

      return {
        success: true,
        message: 'Member removed successfully',
        status: 'su',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to remove member',
        status: 'ic',
      };
    }
  },
};