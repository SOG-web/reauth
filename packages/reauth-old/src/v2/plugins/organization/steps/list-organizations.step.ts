import { type } from 'arktype';
import type { AuthStepV2 } from '../../../types.v2';
import type { ListOrganizationsInput, ListOrganizationsOutput, OrganizationConfigV2 } from '../types';

export const listOrganizationsValidation = type({
  token: 'string',
});

export const listOrganizationsStep: AuthStepV2<
  ListOrganizationsInput,
  ListOrganizationsOutput,
  OrganizationConfigV2
> = {
  name: 'list-organizations',
  description: 'List user\'s organizations',
  validationSchema: listOrganizationsValidation,
  protocol: {
    http: {
      method: 'GET',
      codes: { su: 200, ip: 401 },
      auth: true,
    },
  },
  inputs: ['token'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'organizations?': [{
      id: 'string',
      name: 'string',
      slug: 'string',
      role: 'string',
      'parent_id?': 'string',
      'settings?': 'object',
      'metadata?': 'object',
    }],
  }),
  async run(input, ctx) {
    const { token } = input;
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

    try {
      // Get user's active memberships
      const memberships = await orm.findMany('organization_memberships', {
        where: (b: any) =>
          b.and(
            b('subject_id', '=', subjectId),
            b('status', '=', 'active')
          ),
      });

      if (!memberships || memberships.length === 0) {
        return {
          success: true,
          message: 'No organizations found',
          status: 'su',
          organizations: [],
        };
      }

      // Get organization details for each membership
      const organizationIds = memberships.map((m: any) => m.organization_id);
      
      const organizations = await orm.findMany('organizations', {
        where: (b: any) =>
          b.and(
            b('id', 'in', organizationIds),
            b('is_active', '=', true)
          ),
      });

      if (!organizations) {
        return {
          success: true,
          message: 'No active organizations found',
          status: 'su',
          organizations: [],
        };
      }

      // Combine organization data with user's role
      const result = organizations.map((org: any) => {
        const membership = memberships.find((m: any) => m.organization_id === org.id);
        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          role: membership?.role || 'unknown',
          parent_id: org.parent_id || undefined,
          settings: org.settings || {},
          metadata: org.metadata || {},
        };
      });

      return {
        success: true,
        message: `Found ${result.length} organization${result.length === 1 ? '' : 's'}`,
        status: 'su',
        organizations: result,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to list organizations',
        status: 'ic',
      };
    }
  },
};