import { type } from 'arktype';
import type { AuthStepV2 } from '../../../types.v2';
import type { CreateOrganizationInput, CreateOrganizationOutput, OrganizationConfigV2 } from '../types';
import { generateOrganizationSlug, isSlugAvailable, canCreateOrganization, isValidRole } from '../utils';

export const createOrganizationValidation = type({
  token: 'string',
  name: 'string',
  'slug?': 'string',
  'parent_id?': 'string',
  'settings?': 'object',
  'metadata?': 'object',
});

export const createOrganizationStep: AuthStepV2<
  CreateOrganizationInput,
  CreateOrganizationOutput,
  OrganizationConfigV2
> = {
  name: 'create-organization',
  description: 'Create a new organization (requires authentication)',
  validationSchema: createOrganizationValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 201, ip: 401, ic: 400, eq: 409, unf: 403 },
      auth: true,
    },
  },
  inputs: ['token', 'name', 'slug', 'parent_id', 'settings', 'metadata'],
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
      created_at: 'string',
    },
  }),
  async run(input, ctx) {
    const { token, name, slug, parent_id, settings, metadata } = input;
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

    // Check if user can create more organizations
    const canCreate = await canCreateOrganization(subjectId, orm, ctx.config);
    if (!canCreate) {
      return {
        success: false,
        message: `Maximum organization limit reached (${ctx.config?.maxOrganizationsPerUser || 'unlimited'})`,
        status: 'eq',
      };
    }

    // Validate hierarchy permission if parent_id provided
    if (parent_id && ctx.config?.allowHierarchy !== false) {
      const parentOrg = await orm.findFirst('organizations', {
        where: (b: any) => b('id', '=', parent_id),
      });

      if (!parentOrg) {
        return {
          success: false,
          message: 'Parent organization not found',
          status: 'unf',
        };
      }

      // Check if user has admin access to parent organization
      const parentMembership = await orm.findFirst('organization_memberships', {
        where: (b: any) =>
          b.and(
            b('subject_id', '=', subjectId),
            b('organization_id', '=', parent_id),
            b('role', '=', 'admin'),
            b('status', '=', 'active')
          ),
      });

      if (!parentMembership) {
        return {
          success: false,
          message: 'Admin access required for parent organization',
          status: 'unf',
        };
      }
    } else if (parent_id && ctx.config?.allowHierarchy === false) {
      return {
        success: false,
        message: 'Hierarchical organizations are not enabled',
        status: 'ic',
      };
    }

    // Generate or validate slug
    let finalSlug = slug;
    if (!finalSlug) {
      finalSlug = generateOrganizationSlug(name);
    } else {
      // Validate slug format
      if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(finalSlug)) {
        return {
          success: false,
          message: 'Invalid slug format. Use lowercase letters, numbers, and hyphens only',
          status: 'ic',
        };
      }
    }

    // Check slug availability
    const slugAvailable = await isSlugAvailable(finalSlug, undefined, orm);
    if (!slugAvailable) {
      return {
        success: false,
        message: 'Organization slug already exists',
        status: 'eq',
      };
    }

    try {
      const now = new Date();
      
      // Create organization
      const organizationId = `org_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      
      const organization = await orm.create('organizations', {
        id: organizationId,
        name,
        slug: finalSlug,
        parent_id: parent_id || null,
        settings: settings || {},
        metadata: metadata || {},
        created_at: now,
        updated_at: now,
        is_active: true,
      });

      // Create admin membership for the creator
      const membershipId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      
      await orm.create('organization_memberships', {
        id: membershipId,
        subject_id: subjectId,
        organization_id: organizationId,
        role: 'admin',
        invited_by: subjectId,
        joined_at: now,
        expires_at: null,
        status: 'active',
        created_at: now,
        updated_at: now,
      });

      return {
        success: true,
        message: 'Organization created successfully',
        status: 'su',
        organization: {
          id: organizationId,
          name,
          slug: finalSlug,
          parent_id: parent_id || undefined,
          settings: settings || {},
          metadata: metadata || {},
          created_at: now.toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create organization',
        status: 'ic',
      };
    }
  },
};