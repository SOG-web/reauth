import type { AuthPluginV2, OrmLike } from '../../types.v2';
import type { OrganizationConfigV2 } from './types';
export type { OrganizationConfigV2 } from './types';
import { createOrganizationStep } from './steps/create-organization.step';
import { inviteMemberStep } from './steps/invite-member.step';
import { acceptInvitationStep } from './steps/accept-invitation.step';
import { listOrganizationsStep } from './steps/list-organizations.step';
import { getOrganizationStep } from './steps/get-organization.step';
import { updateOrganizationStep } from './steps/update-organization.step';
import { removeMemberStep } from './steps/remove-member.step';
import { changeMemberRoleStep } from './steps/change-member-role.step';
import { createAuthPluginV2 } from '../../utils/create-plugin.v2';
import { cleanupExpiredInvitations, cleanupExpiredMemberships } from './utils';

export const baseOrganizationPluginV2: AuthPluginV2<OrganizationConfigV2> = {
  name: 'organization',
  initialize(engine) {
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
            b.and(
              b('subject_id', '=', id),
              b('status', '=', 'active')
            ),
        });

        return {
          ...subject,
          organizations: memberships || [],
        } as unknown as import('../../types.v2').Subject;
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
    const config = this.config || {};
    if (config.cleanupEnabled !== false) {
      const cleanupIntervalMs = (config.cleanupIntervalMinutes || 120) * 60 * 1000; // Default 2 hours

      // Cleanup task for expired invitations
      engine.registerCleanupTask({
        name: 'expired-invitations',
        pluginName: 'organization',
        intervalMs: cleanupIntervalMs,
        enabled: true,
        runner: async (orm, pluginConfig) => {
          try {
            const invitationResult = await cleanupExpiredInvitations(orm, pluginConfig);
            const membershipResult = await cleanupExpiredMemberships(orm, pluginConfig);
            
            const totalCleaned = invitationResult.expiredInvitationsDeleted + 
                               invitationResult.revokedInvitationsDeleted + 
                               membershipResult.membershipsDeleted;

            const allErrors = [
              ...(invitationResult.errors || []),
              ...(membershipResult.errors || []),
            ];

            return {
              cleaned: totalCleaned,
              expiredInvitationsDeleted: invitationResult.expiredInvitationsDeleted,
              revokedInvitationsDeleted: invitationResult.revokedInvitationsDeleted,
              membershipsDeleted: membershipResult.membershipsDeleted,
              ...(allErrors.length > 0 && { errors: allErrors }),
            };
          } catch (error) {
            return {
              cleaned: 0,
              expiredInvitationsDeleted: 0,
              revokedInvitationsDeleted: 0,
              membershipsDeleted: 0,
              errors: [`Organization cleanup failed: ${error instanceof Error ? error.message : String(error)}`],
            };
          }
        },
      });
    }
  },
  config: {
    maxOrganizationsPerUser: 10, // Reasonable default limit
    allowHierarchy: true, // Enable parent/child relationships
    defaultRole: 'member', // Default role for new members
    availableRoles: ['admin', 'member', 'viewer'], // Allowed roles
    invitationTtlDays: 7, // Invitations valid for 7 days
    
    // Cleanup configuration following anonymous plugin pattern
    cleanupEnabled: true,
    cleanupIntervalMinutes: 120, // Every 2 hours
    invitationRetentionDays: 30, // Keep expired invitations for 30 days
    cleanupBatchSize: 100, // Process in batches
    revokedInvitationRetentionDays: 7, // Keep revoked invitations for 7 days
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
  ],
};

// Export a configured plugin creator that validates config at construction time
const organizationPluginV2: AuthPluginV2<OrganizationConfigV2> = createAuthPluginV2<OrganizationConfigV2>(
  baseOrganizationPluginV2,
  {
    validateConfig: (config) => {
      const errs: string[] = [];
      
      // Validate organization limits
      if (config.maxOrganizationsPerUser && config.maxOrganizationsPerUser < 1) {
        errs.push('maxOrganizationsPerUser must be at least 1');
      }
      
      if (config.maxOrganizationsPerUser && config.maxOrganizationsPerUser > 100) {
        errs.push('maxOrganizationsPerUser cannot exceed 100 for performance reasons');
      }

      // Validate invitation settings
      if (config.invitationTtlDays && config.invitationTtlDays < 1) {
        errs.push('invitationTtlDays must be at least 1 day');
      }
      
      if (config.invitationTtlDays && config.invitationTtlDays > 30) {
        errs.push('invitationTtlDays cannot exceed 30 days for security reasons');
      }

      // Validate roles
      if (config.availableRoles && config.availableRoles.length === 0) {
        errs.push('availableRoles cannot be empty');
      }
      
      if (config.defaultRole && config.availableRoles && !config.availableRoles.includes(config.defaultRole)) {
        errs.push('defaultRole must be included in availableRoles');
      }

      // Validate cleanup configuration
      if (config.cleanupIntervalMinutes && config.cleanupIntervalMinutes < 60) {
        errs.push('cleanupIntervalMinutes must be at least 60 minutes to avoid excessive cleanup frequency');
      }
      
      if (config.cleanupIntervalMinutes && config.cleanupIntervalMinutes > 1440) {
        errs.push('cleanupIntervalMinutes cannot exceed 1440 minutes (24 hours) for effective cleanup');
      }
      
      if (config.invitationRetentionDays && config.invitationRetentionDays < 1) {
        errs.push('invitationRetentionDays must be at least 1 day');
      }
      
      if (config.cleanupBatchSize && config.cleanupBatchSize < 1) {
        errs.push('cleanupBatchSize must be at least 1');
      }
      
      if (config.cleanupBatchSize && config.cleanupBatchSize > 1000) {
        errs.push('cleanupBatchSize cannot exceed 1000 for performance reasons');
      }
      
      if (config.revokedInvitationRetentionDays && config.revokedInvitationRetentionDays < 1) {
        errs.push('revokedInvitationRetentionDays must be at least 1 day');
      }
      
      return errs.length ? errs : null;
    },
  },
);

export default organizationPluginV2;