import { type } from 'arktype';
import type { AuthStepV2 } from '../../../types.v2';
import type { UpdateOrganizationInput, UpdateOrganizationOutput, OrganizationConfigV2 } from '../types';
import { hasOrganizationPermission, isSlugAvailable } from '../utils';

export const updateOrganizationValidation = type({
  token: 'string',
  organization_id: 'string',
  'name?': 'string',
  'slug?': 'string',
  'settings?': 'object',
  'metadata?': 'object',
});

export const updateOrganizationStep: AuthStepV2<
  UpdateOrganizationInput,
  UpdateOrganizationOutput,
  OrganizationConfigV2
> = {
  name: 'update-organization',
  description: 'Update organization settings (requires admin role)',
  validationSchema: updateOrganizationValidation,
  protocol: {
    http: {
      method: 'PUT',
      codes: { su: 200, ip: 401, ic: 400, unf: 404, eq: 409 },
      auth: true,
    },
  },
  inputs: ['token', 'organization_id', 'name', 'slug', 'settings', 'metadata'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'organization?': {
      id: 'string',
      name: 'string',
      slug: 'string',
      'settings?': 'object',
      'metadata?': 'object',
      updated_at: 'string',
    },
  }),
  async run(input, ctx) {
    const { token, organization_id, name, slug, settings, metadata } = input;
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
    const hasPermission = await hasOrganizationPermission(subjectId, organization_id, 'admin', orm);
    if (!hasPermission) {
      return {
        success: false,
        message: 'Admin access required to update organization',
        status: 'unf',
      };
    }

    // Validate slug if provided
    if (slug) {
      if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
        return {
          success: false,
          message: 'Invalid slug format. Use lowercase letters, numbers, and hyphens only',
          status: 'ic',
        };
      }

      // Check slug availability (excluding current organization)
      const slugAvailable = await isSlugAvailable(slug, organization_id, orm);
      if (!slugAvailable) {
        return {
          success: false,
          message: 'Slug already exists',
          status: 'eq',
        };
      }
    }

    try {
      const now = new Date();
      const updateData: any = {
        updated_at: now,
      };

      // Only update provided fields
      if (name !== undefined) updateData.name = name;
      if (slug !== undefined) updateData.slug = slug;
      if (settings !== undefined) updateData.settings = settings;
      if (metadata !== undefined) updateData.metadata = metadata;

      await orm.updateMany('organizations', {
        where: (b: any) => b('id', '=', organization_id),
        set: updateData,
      });

      // Get updated organization
      const updatedOrg = await orm.findFirst('organizations', {
        where: (b: any) => b('id', '=', organization_id),
      });

      return {
        success: true,
        message: 'Organization updated successfully',
        status: 'su',
        organization: {
          id: updatedOrg!.id,
          name: updatedOrg!.name,
          slug: updatedOrg!.slug,
          settings: updatedOrg!.settings || {},
          metadata: updatedOrg!.metadata || {},
          updated_at: now.toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update organization',
        status: 'ic',
      };
    }
  },
};