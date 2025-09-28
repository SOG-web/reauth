import { type } from 'arktype';
import { type AuthStep, tokenType } from '../../../types';
import {
  UpdateOrganizationInput,
  UpdateOrganizationOutput,
  OrganizationConfig,
} from '../types';
import { hasOrganizationPermission, isSlugAvailable } from '../utils';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export const updateOrganizationValidation = type({
  token: tokenType,
  organization_id: 'string',
  'name?': 'string',
  'slug?': 'string',
  'settings?': 'object',
  'metadata?': 'object',
});

export const updateOrganizationStep: AuthStep<
  OrganizationConfig,
  UpdateOrganizationInput,
  UpdateOrganizationOutput
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
    'token?': tokenType,
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
      subjectId,
      organization_id,
      'admin',
      orm,
    );
    if (!hasPermission) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Admin access required to update organization',
          status: 'unf',
        },
        token,
        session.token,
      );
    }

    // Validate slug if provided
    if (slug) {
      if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
        return attachNewTokenIfDifferent(
          {
            success: false,
            message:
              'Invalid slug format. Use lowercase letters, numbers, and hyphens only',
            status: 'ic',
          },
          token,
          session.token,
        );
      }

      // Check slug availability (excluding current organization)
      const slugAvailable = await isSlugAvailable(slug, organization_id, orm);
      if (!slugAvailable) {
        return attachNewTokenIfDifferent(
          {
            success: false,
            message: 'Slug already exists',
            status: 'eq',
          },
          token,
          session.token,
        );
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

      await (orm as any).updateMany('organizations', {
        where: (b: any) => b('id', '=', organization_id),
        set: updateData,
      });

      // Get updated organization
      const updatedOrg = await orm.findFirst('organizations', {
        where: (b: any) => b('id', '=', organization_id),
      });

      return attachNewTokenIfDifferent(
        {
          success: true,
          message: 'Organization updated successfully',
          status: 'su',
          organization: {
            id: updatedOrg!.id as string,
            name: updatedOrg!.name as string,
            slug: updatedOrg!.slug as string,
            settings: updatedOrg!.settings as any,
            metadata: updatedOrg!.metadata as any,
            updated_at: now.toISOString(),
          },
        },
        token,
        session.token,
      );
    } catch (error) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Failed to update organization',
          status: 'ic',
        },
        token,
        session.token,
      );
    }
  },
};
