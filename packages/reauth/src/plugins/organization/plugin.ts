import type { AuthPlugin, AuthStep, OrmLike, Subject } from '../../types';
import type { OrganizationConfig } from './types';
import { createOrganizationStep } from './steps/create-organization.step';
import { inviteMemberStep } from './steps/invite-member.step';
import { acceptInvitationStep } from './steps/accept-invitation.step';
import { listOrganizationsStep } from './steps/list-organizations.step';
import { getOrganizationStep } from './steps/get-organization.step';
import { updateOrganizationStep } from './steps/update-organization.step';
import { removeMemberStep } from './steps/remove-member.step';
import { changeMemberRoleStep } from './steps/change-member-role.step';
import { setRolesPermissionsStep } from './steps/roles-permission.step';
import { getRolesPermissionsStep } from './steps/get-roles-permissions.step';
import { createAuthPlugin } from '../../utils/create-plugin';
import { cleanupExpiredInvitations, cleanupExpiredMemberships } from './utils';

export const baseOrganizationPlugin: AuthPlugin<
  OrganizationConfig,
  'organization'
> = {
  name: 'organization',
  initialize(engine) {
    const config = this.config;

    if (config.useEmailPlugin && !engine.getPlugin('email-password')) {
      throw new Error('Email plugin is required when useEmailPlugin is true');
    }

    if (!config.useEmailPlugin && !config.getEmail) {
      throw new Error(
        'getEmail function is required when useEmailPlugin is false',
      );
    }

    // Register session resolver for organization-aware subjects
    engine.registerSessionResolver('subject', {
      async getById(id: string, orm: OrmLike) {
        const subject = await orm.findFirst('subjects', {
          where: (b: any) => b('id', '=', id),
        });

        if (!subject) return null;

        // Enhance subject with organization memberships
        const memberships = await orm.findMany('organization_memberships', {
          where: (b: any) =>
            b.and(b('subject_id', '=', id), b('status', '=', 'active')),
        });

        return {
          ...subject,
          organizations: memberships || [],
        } as unknown as Subject;
      },
      sanitize(subject: any) {
        // Remove sensitive organization data from public responses
        const { organizations, ...sanitized } = subject;
        return {
          ...sanitized,
          organizationCount: organizations?.length || 0,
        };
      },
    });

    // Register background cleanup tasks if enabled

    const cleanupIntervalMs =
      (config.cleanupIntervalMinutes || 120) * 60 * 1000; // Default 2 hours

    // Cleanup task for expired invitations
    engine.registerCleanupTask({
      name: 'expired-invitations',
      pluginName: 'organization',
      intervalMs: cleanupIntervalMs,
      enabled: true,
      runner: async (orm, pluginConfig) => {
        try {
          const invitationResult = await cleanupExpiredInvitations(
            orm,
            pluginConfig,
          );
          const membershipResult = await cleanupExpiredMemberships(
            orm,
            pluginConfig,
          );

          const totalCleaned =
            invitationResult.expiredInvitationsDeleted +
            invitationResult.revokedInvitationsDeleted +
            membershipResult.membershipsDeleted;

          const allErrors = [
            ...(invitationResult.errors || []),
            ...(membershipResult.errors || []),
          ];

          return {
            cleaned: totalCleaned,
            expiredInvitationsDeleted:
              invitationResult.expiredInvitationsDeleted,
            revokedInvitationsDeleted:
              invitationResult.revokedInvitationsDeleted,
            membershipsDeleted: membershipResult.membershipsDeleted,
            ...(allErrors.length > 0 && { errors: allErrors }),
          };
        } catch (error) {
          return {
            cleaned: 0,
            expiredInvitationsDeleted: 0,
            revokedInvitationsDeleted: 0,
            membershipsDeleted: 0,
            errors: [
              `Organization cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
            ],
          };
        }
      },
    });
  },
  config: {
    maxOrganizationsPerUser: 10, // Reasonable default limit
    allowHierarchy: true, // Enable parent/child relationships
    defaultRole: 'member', // Default role for new members
    availableRoles: ['admin', 'member', 'viewer'], // Allowed roles
    invitationTtlDays: 7, // Invitations valid for 7 days

    // Cleanup configuration following anonymous plugin pattern
    cleanupIntervalMinutes: 120, // Every 2 hours

    useEmailPlugin: true,
  },
  steps: [
    createOrganizationStep,
    inviteMemberStep,
    acceptInvitationStep,
    listOrganizationsStep,
    getOrganizationStep,
    updateOrganizationStep,
    removeMemberStep,
    changeMemberRoleStep,
    setRolesPermissionsStep,
    getRolesPermissionsStep,
  ],
  async getProfile(subjectId, ctx) {
    const orm = await ctx.engine.getOrm();
    const memberships = await orm.findMany('organization_memberships', {
      where: (b: any) => b('subject_id', '=', subjectId),
      orderBy: [['created_at', 'desc']],
    });

    const items: any[] = [];
    for (const m of memberships || []) {
      let orgName: string | undefined;
      try {
        const org = await orm.findFirst('organizations', {
          where: (b: any) => b('id', '=', m.organization_id),
        });
        orgName = org?.name ? String(org.name) : undefined;
      } catch {}

      const createdAt = m?.created_at
        ? m.created_at instanceof Date
          ? m.created_at.toISOString()
          : new Date(String(m.created_at)).toISOString()
        : undefined;
      const updatedAt = m?.updated_at
        ? m.updated_at instanceof Date
          ? m.updated_at.toISOString()
          : new Date(String(m.updated_at)).toISOString()
        : undefined;

      items.push({
        organization_id: String(m.organization_id),
        organization_name: orgName,
        role: String(m.role ?? ''),
        status: String(m.status ?? ''),
        created_at: createdAt,
        updated_at: updatedAt,
      });
    }

    return { organizations: items };
  },
};

// Export a factory function that creates a configured plugin
const organizationPlugin = (
  config: Partial<OrganizationConfig>,
  overrideStep?: Array<{
    name: string;
    override: Partial<AuthStep<OrganizationConfig>>;
  }>,
): AuthPlugin<OrganizationConfig, 'organization'> =>
  createAuthPlugin<OrganizationConfig, 'organization'>(baseOrganizationPlugin, {
    config,
    stepOverrides: overrideStep,
    validateConfig: (config) => {
      const errs: string[] = [];

      if (!config.useEmailPlugin && !config.getEmail) {
        errs.push('getEmail function is required when useEmailPlugin is false');
      }

      // Validate organization limits
      if (
        config.maxOrganizationsPerUser &&
        config.maxOrganizationsPerUser < 1
      ) {
        errs.push('maxOrganizationsPerUser must be at least 1');
      }

      if (
        config.maxOrganizationsPerUser &&
        config.maxOrganizationsPerUser > 100
      ) {
        errs.push(
          'maxOrganizationsPerUser cannot exceed 100 for performance reasons',
        );
      }

      // Validate invitation settings
      if (config.invitationTtlDays && config.invitationTtlDays < 1) {
        errs.push('invitationTtlDays must be at least 1 day');
      }

      if (config.invitationTtlDays && config.invitationTtlDays > 30) {
        errs.push(
          'invitationTtlDays cannot exceed 30 days for security reasons',
        );
      }

      // Validate roles
      if (config.availableRoles && config.availableRoles.length === 0) {
        errs.push('availableRoles cannot be empty');
      }

      if (
        config.defaultRole &&
        config.availableRoles &&
        !config.availableRoles.includes(config.defaultRole)
      ) {
        errs.push('defaultRole must be included in availableRoles');
      }

      // Validate cleanup configuration
      if (config.cleanupIntervalMinutes && config.cleanupIntervalMinutes < 60) {
        errs.push(
          'cleanupIntervalMinutes must be at least 60 minutes to avoid excessive cleanup frequency',
        );
      }

      if (
        config.cleanupIntervalMinutes &&
        config.cleanupIntervalMinutes > 1440
      ) {
        errs.push(
          'cleanupIntervalMinutes cannot exceed 1440 minutes (24 hours) for effective cleanup',
        );
      }

      return errs.length ? errs : null;
    },
  }) as AuthPlugin<OrganizationConfig, 'organization'>;

export default organizationPlugin;
