import { column, idColumn, table } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../types';

// Subject roles table for role-based access control
export const subjectRoles = table('subject_roles', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  subject_id: column('subject_id', 'varchar(255)'),
  role: column('role', 'varchar(255)'),
  permissions: column('permissions', 'json').nullable(), // JSON array of permissions
  assigned_by: column('assigned_by', 'varchar(255)').nullable(),
  assigned_at: column('assigned_at', 'timestamp').defaultTo$('now'),
  expires_at: column('expires_at', 'timestamp').nullable(),
  revoked_at: column('revoked_at', 'timestamp').nullable(),
  revoked_by: column('revoked_by', 'varchar(255)').nullable(),
  revoked_reason: column('revoked_reason', 'varchar(1000)').nullable(),
  metadata: column('metadata', 'json').nullable(),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
}).unique('subject_role_uk', ['subject_id', 'role']);

// User bans table for banning/unbanning users
export const userBans = table('user_bans', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  subject_id: column('subject_id', 'varchar(255)'),
  banned_by: column('banned_by', 'varchar(255)'),
  ban_type: column('ban_type', 'varchar(50)').defaultTo$(() => 'temporary'), // temporary, permanent
  reason: column('reason', 'varchar(1000)'),
  duration_seconds: column('duration_seconds', 'integer').nullable(),
  expires_at: column('expires_at', 'timestamp').nullable(),
  lifted_at: column('lifted_at', 'timestamp').nullable(),
  lifted_by: column('lifted_by', 'varchar(255)').nullable(),
  lifted_reason: column('lifted_reason', 'varchar(1000)').nullable(),
  metadata: column('metadata', 'json').nullable(),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
}).unique('user_ban_active_uk', ['subject_id']); // Allow only one active ban per user

// Audit logs table for comprehensive admin action logging
export const auditLogs = table('audit_logs', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  actor_id: column('actor_id', 'varchar(255)'), // Who performed the action
  action: column('action', 'varchar(255)'), // Action type (create_user, ban_user, etc.)
  target_type: column('target_type', 'varchar(255)').nullable(), // subject, organization, etc.
  target_id: column('target_id', 'varchar(255)').nullable(), // ID of the affected resource
  details: column('details', 'json').nullable(), // JSON details of the action
  ip_address: column('ip_address', 'varchar(45)').nullable(), // IPv4/IPv6 address
  user_agent: column('user_agent', 'varchar(1000)').nullable(), // Browser/client info
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
});

export const adminSchema: ReauthSchemaPlugin = {
  tables: {
    subject_roles: subjectRoles,
    user_bans: userBans,
    audit_logs: auditLogs,
  },
  relations: {},
  extendTables: {
    subjects: {
      // Add admin-specific fields to subjects table
      is_active: column('is_active', 'bool').defaultTo$(() => true),
      deleted_at: column('deleted_at', 'timestamp').nullable(),
      deleted_by: column('deleted_by', 'varchar(255)').nullable(),
      deleted_reason: column('deleted_reason', 'varchar(1000)').nullable(),
      last_login_at: column('last_login_at', 'timestamp').nullable(),
    },
  },
};
