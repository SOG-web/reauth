import { type } from 'arktype';
import type { AuthStep } from '../../../types';
import type {
  ListOrganizationsInput,
  ListOrganizationsOutput,
  OrganizationConfig,
} from '../types';

export const listOrganizationsValidation = type({
  token: 'string',
});

export const listOrganizationsStep: AuthStep<
  OrganizationConfig,
  ListOrganizationsInput,
  ListOrganizationsOutput
> = {
  name: 'list-organizations',
  description: "List user's organizations",
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
    'organizations?': [
      {
        id: 'string',
        name: 'string',
        slug: 'string',
        role: 'string',
        email: 'string',
        roles: 'string',
        permissions: 'string',
        status: 'string',
        invited_by: 'string',
        joined_at: 'string',
        expires_at: 'string',
        'parent_id?': 'string',
        'settings?': 'object',
        'metadata?': 'object',
      },
    ],
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
          b.and(b('subject_id', '=', subjectId), b('status', '=', 'active')),
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
          b.and(b('id', 'in', organizationIds), b('is_active', '=', true)),
      });

      if (!organizations) {
        return {
          success: true,
          message: 'No active organizations found',
          status: 'su',
          organizations: [],
        };
      }

      //TODO: improve security of data returned based on user's role
      // Combine organization data with user's role
      const result = organizations.map((org: any) => {
        const membership = memberships.find(
          (m: any) => m.organization_id === org.id,
        );
        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          role: (membership?.role as string) || 'unknown',
          email: (membership?.email as string) || 'unknown',
          roles: (membership?.roles as string).split(',') || [],
          permissions: (membership?.permissions as string).split(',') || [],
          status: membership?.status || 'unknown',
          invited_by: (membership?.invited_by as string) || 'unknown',
          joined_at: (membership?.joined_at as string) || 'unknown',
          expires_at: (membership?.expires_at as string) || 'unknown',
          parent_id: (org.parent_id as string) || undefined,
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
