import { type } from 'arktype';
import type { AuthStep } from '../../../types';
import type {
  GetOrganizationInput,
  GetOrganizationOutput,
  OrganizationConfig,
} from '../types';
import { hasOrganizationPermission } from '../utils';

export const getOrganizationValidation = type({
  token: 'string',
  organization_id: 'string',
});

export const getOrganizationStep: AuthStep<
  OrganizationConfig,
  GetOrganizationInput,
  GetOrganizationOutput
> = {
  name: 'get-organization',
  description: 'Get organization details (requires membership)',
  validationSchema: getOrganizationValidation,
  protocol: {
    http: {
      method: 'GET',
      codes: { su: 200, ip: 401, unf: 404 },
      auth: true,
    },
  },
  inputs: ['token', 'organization_id'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'organization?': {
      id: 'string',
      name: 'string',
      slug: 'string',
      'parent_id?': 'string',
      'settings?': 'object',
      'metadata?': 'object',
      role: 'string',
      'members?': [
        {
          subject_id: 'string',
          role: 'string',
          joined_at: 'string',
        },
      ],
    },
  }),
  async run(input, ctx) {
    const { token, organization_id } = input;
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

    // Check if user is a member
    const membership = await orm.findFirst('organization_memberships', {
      where: (b: any) =>
        b.and(
          b('subject_id', '=', subjectId),
          b('organization_id', '=', organization_id),
          b('status', '=', 'active'),
        ),
    });

    if (!membership) {
      return {
        success: false,
        message: 'Access denied - not a member of this organization',
        status: 'unf',
      };
    }

    try {
      //TODO: improve to include sub organizations
      // Get organization members (only if user is admin)
      let members: any[] | undefined;
      if (membership.role === 'admin') {
        const allMembers = await orm.findMany('organization_memberships', {
          where: (b: any) =>
            b.and(
              b('organization_id', '=', organization_id),
              b('status', '=', 'active'),
            ),
        });

        members = (allMembers || []).map((m: any) => ({
          subject_id: m.subject_id,
          role: m.role,
          joined_at: new Date(m.joined_at).toISOString(),
        }));
      }

      return {
        success: true,
        message: 'Organization details retrieved successfully',
        status: 'su',
        organization: {
          id: organization.id as string,
          name: organization.name as string,
          slug: organization.slug as string,
          parent_id: (organization.parent_id as string) || undefined,
          settings: organization.settings || {},
          metadata: organization.metadata || {},
          role: membership.role as string,
          members,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve organization details',
        status: 'ic',
      };
    }
  },
};
