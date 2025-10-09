import type { OrmLike } from '../../types';
import type { AdminAction, AdminConfig } from './types';

export async function cleanupExpiredAuditLogs(
  orm: OrmLike,
  config?: AdminConfig,
) {
  const retentionDays = config?.auditLogRetentionDays || 90;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const countResult = await orm.count('audit_logs', {
    where: (b) => b('created_at', '<', cutoffDate),
  });

  await orm.deleteMany('audit_logs', {
    where: (b) => b('created_at', '<', cutoffDate),
  });

  return {
    deletedCount: countResult,
    retentionDays,
    cutoffDate,
  };
}

export async function getAdminPermissions(
  orm: OrmLike,
  subjectId: string,
  config?: AdminConfig,
) {
  const adminRole = config?.adminRole || 'admin';

  const roles = (await orm.findMany('subject_roles', {
    where: (b) =>
      b.and(b('subject_id', '=', subjectId), b('role', '=', adminRole)),
  })) as any;

  const permissions = new Set<string>();
  roles?.forEach((role) => {
    if (role.permissions) {
      role.permissions.forEach((perm: string) => permissions.add(perm));
    }
  });

  return {
    isAdmin: roles && roles.length > 0,
    permissions: Array.from(permissions),
    roles: roles?.map((r) => r.role) || [],
  };
}

export async function logAdminAction(
  orm: OrmLike,
  action: AdminAction,
  config?: AdminConfig,
) {
  if (!config?.enableAuditLogging) {
    return null;
  }

  return await orm.create('audit_logs', {
    actor_id: action.actorId,
    action: action.action,
    target_type: action.targetType,
    target_id: action.targetId,
    details: action.details ? JSON.stringify(action.details) : null,
    ip_address: action.ipAddress,
    user_agent: action.userAgent,
    created_at: action.timestamp,
  });
}
