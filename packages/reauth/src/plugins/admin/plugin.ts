import type { AuthPlugin, AuthStep, Subject } from '../../types';
import type { AdminConfig } from './types';
import { createUserStep } from './steps/create-user.step';
import { updateUserStep } from './steps/update-user.step';
import { deleteUserStep } from './steps/delete-user.step';
import { listUsersStep } from './steps/list-users.step';
import { assignRoleStep } from './steps/assign-role.step';
import { revokeRoleStep } from './steps/revoke-role.step';
import { viewAuditLogsStep } from './steps/view-audit-logs.step';
import { systemStatusStep } from './steps/system-status.step';
import { createAuthPlugin } from '../../utils/create-plugin';
import { cleanupExpiredAuditLogs } from './utils';

export const baseAdminPlugin = {
  name: 'admin',
  initialize(engine) {
    // Register admin role resolver
    engine.registerSessionResolver('admin-subject', {
      async getById(id: string, orm) {
        const subject = await orm.findFirst('subjects', {
          where: (b) => b('id', '=', id),
        });

        if (!subject) return null;

        // Check if user has admin role
        const adminRole = await orm.findFirst('subject_roles', {
          where: (b) =>
            b.and(b('subject_id', '=', id), b('role', '=', 'admin')),
        });

        return adminRole ? (subject as Subject) : null;
      },
      sanitize(subject: any) {
        // Remove sensitive admin data
        const { isAdmin, ...sanitized } = subject;
        return sanitized;
      },
    });

    // Register universal ban check hook - applies to ALL plugins/steps
    engine.registerAuthHook({
      type: 'before',
      universal: true, // Applies to all plugins and steps
      async fn(input, container, error, pluginName, stepName) {
        // Skip if no input or no token
        if (
          !input ||
          typeof input !== 'object' ||
          !('token' in input) ||
          !input.token
        ) {
          return input;
        }

        try {
          const engine = container.cradle.engine;
          const session = await engine.checkSession(input.token);

          if (session.subject) {
            const orm = await engine.getOrm();

            // Check for active bans
            const activeBan = await orm.findFirst('user_bans', {
              where: (b) =>
                b.and(
                  b('subject_id', '=', session.subject!.id),
                  b.or(
                    b('expires_at', '>', new Date()),
                    b('expires_at', '=', null),
                  ),
                ),
            });

            if (activeBan) {
              // Get ban configuration from admin plugin config
              const adminPlugin = engine.getPlugin('admin') as any;
              const banConfig = adminPlugin?.config?.banConfig || {};

              // Check if this ban reason allows the action
              const banReason = String(activeBan.reason || 'banned');
              const allowedReasons = banConfig.allowedReasons || [];
              const isReasonAllowed = allowedReasons.includes(banReason);

              // Check if current plugin/step allows access for banned users
              const allowedPlugins = banConfig.allowedPlugins || [];
              const allowedSteps = banConfig.allowedSteps || [];
              const currentPlugin = pluginName;
              const currentStep = stepName;

              const isPluginAllowed = allowedPlugins.includes(currentPlugin);
              const isStepAllowed = allowedSteps.includes(currentStep);

              // Allow access if reason OR plugin OR step is allowed
              const isAllowed =
                isReasonAllowed || isPluginAllowed || isStepAllowed;

              if (!isAllowed) {
                // User is banned and this configuration doesn't allow access
                const banMessage = String(
                  activeBan.reason || 'Your account has been banned',
                );
                const error = new Error(banMessage);
                (error as any).status = 'aut';
                (error as any).code = 'ACCOUNT_BANNED';
                (error as any).banExpiresAt = (
                  activeBan.expires_at as Date
                )?.toISOString();
                (error as any).banReason = activeBan.reason;
                (error as any).pluginName = currentPlugin;
                (error as any).stepName = currentStep;
                throw error;
              }
            }
          }
        } catch (error) {
          // Re-throw ban errors
          if ((error as any).code === 'ACCOUNT_BANNED') {
            throw error;
          }
          // If ban check fails for other reasons, log but don't block (fail open)
          console.warn('Failed to check user ban status:', error);
        }

        return input;
      },
    });

    // Register cleanup task for audit logs
    const cleanupIntervalMs =
      (this.config?.auditLogRetentionDays || 90) * 24 * 60 * 60 * 1000;

    engine.registerCleanupTask({
      name: 'expired-audit-logs',
      pluginName: 'admin',
      intervalMs: cleanupIntervalMs,
      enabled: true,
      runner: async (orm) => {
        const result = await cleanupExpiredAuditLogs(orm, this.config);
        return {
          cleaned: result.deletedCount,
          auditLogsDeleted: result.deletedCount,
        };
      },
    });
  },
  config: {
    // Default admin role
    adminRole: 'admin',
    // Available roles
    availableRoles: ['admin', 'moderator', 'user'],
    // Audit logging
    enableAuditLogging: true,
    auditLogRetentionDays: 90,
    // Security
    requireMfaForAdmin: true,
    maxAdminSessionDuration: 3600, // 1 hour
    // User management
    allowAdminCreateUser: true,
    allowAdminDeleteUser: true,
    // Rate limiting for admin operations
    rateLimitPerHour: 100,
    // Ban configuration - by default, no ban reasons allow access
    banConfig: {
      allowedReasons: [], // No ban reasons allow continued access by default
      allowedPlugins: [],
      allowedSteps: [],
    },
  },
  steps: [
    createUserStep,
    updateUserStep,
    deleteUserStep,
    listUsersStep,
    assignRoleStep,
    revokeRoleStep,
    viewAuditLogsStep,
    systemStatusStep,
  ],
  getSensitiveFields() {
    return ['audit_logs', 'admin_actions'];
  },
  async getProfile(subjectId, ctx) {
    const orm = await ctx.engine.getOrm();

    // Get admin status
    const adminRole = await orm.findFirst('subject_roles', {
      where: (b) =>
        b.and(b('subject_id', '=', subjectId), b('role', '=', 'admin')),
    });

    if (!adminRole) {
      return { isAdmin: false };
    }

    // Get recent admin actions
    const recentActions = await orm.findMany('audit_logs', {
      where: (b) =>
        b.and(b('actor_id', '=', subjectId), b('action', '!=', null)),
      orderBy: [['created_at', 'desc']],
      limit: 10,
    });

    return {
      isAdmin: true,
      role: adminRole.role,
      permissions: adminRole.permissions || [],
      recentActions:
        recentActions?.map((action) => ({
          id: action.id,
          action: action.action,
          targetType: action.target_type,
          details: action.details,
        })) || [],
    };
  },
} satisfies AuthPlugin<AdminConfig, 'admin'>;

// Export a factory function that creates a configured plugin
const adminPlugin = (
  config: Partial<AdminConfig>,
  overrideStep?: Array<{
    name: string;
    override: Partial<AuthStep<AdminConfig>>;
  }>,
) => {
  const pl = createAuthPlugin<AdminConfig, 'admin', typeof baseAdminPlugin>(
    baseAdminPlugin,
    {
      config,
      stepOverrides: overrideStep,
      validateConfig: (config) => {
        const errs: string[] = [];

        // Validate roles
        if (config.availableRoles && config.availableRoles.length === 0) {
          errs.push('availableRoles cannot be empty');
        }

        if (
          config.adminRole &&
          config.availableRoles &&
          !config.availableRoles.includes(config.adminRole)
        ) {
          errs.push('adminRole must be included in availableRoles');
        }

        // Validate audit settings
        if (config.auditLogRetentionDays && config.auditLogRetentionDays < 1) {
          errs.push('auditLogRetentionDays must be at least 1 day');
        }

        // Validate security settings
        if (
          config.maxAdminSessionDuration &&
          config.maxAdminSessionDuration < 300
        ) {
          errs.push(
            'maxAdminSessionDuration must be at least 300 seconds (5 minutes)',
          );
        }

        // Validate rate limiting
        if (config.rateLimitPerHour && config.rateLimitPerHour < 1) {
          errs.push('rateLimitPerHour must be at least 1');
        }

        return errs.length ? errs : null;
      },
      rootHooks: config.rootHooks,
    },
  ) satisfies typeof baseAdminPlugin;

  return pl;
};

export default adminPlugin;
