import { column, idColumn, table } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../../types';

// Organizations table for multi-tenant structure
export const organizations = table('organizations', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  name: column('name', 'varchar(255)'),
  slug: column('slug', 'varchar(255)'),
  parent_id: column('parent_id', 'varchar(255)').nullable(), // for hierarchy
  settings: column('settings', 'json').nullable(), // JSON configuration
  metadata: column('metadata', 'json').nullable(), // JSON metadata
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
  is_active: column('is_active', 'bool').defaultTo$(() => true),
})
  .unique('org_slug_uk', ['slug'])
  .index('org_parent_idx', ['parent_id']);

// Organization memberships table for user-organization relationships
export const organizationMemberships = table('organization_memberships', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  subject_id: column('subject_id', 'varchar(255)'),
  organization_id: column('organization_id', 'varchar(255)'),
  role: column('role', 'varchar(255)'),
  invited_by: column('invited_by', 'varchar(255)').nullable(),
  joined_at: column('joined_at', 'timestamp').defaultTo$('now'),
  expires_at: column('expires_at', 'timestamp').nullable(),
  status: column('status', 'varchar(255)').defaultTo$(() => 'active'), // pending, active, suspended
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
})
  .unique('org_membership_uk', ['subject_id', 'organization_id'])
  .index('org_membership_subject_idx', ['subject_id'])
  .index('org_membership_org_idx', ['organization_id'])
  .index('org_membership_status_idx', ['status']);

// Organization invitations table for pending invitations
export const organizationInvitations = table('organization_invitations', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  organization_id: column('organization_id', 'varchar(255)'),
  email: column('email', 'varchar(255)'),
  role: column('role', 'varchar(255)'),
  invited_by: column('invited_by', 'varchar(255)'),
  token: column('token', 'varchar(255)'),
  expires_at: column('expires_at', 'timestamp'),
  accepted_at: column('accepted_at', 'timestamp').nullable(),
  status: column('status', 'varchar(255)').defaultTo$(() => 'pending'), // pending, accepted, expired, revoked
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
})
  .unique('org_invitation_token_uk', ['token'])
  .index('org_invitation_org_idx', ['organization_id'])
  .index('org_invitation_email_idx', ['email'])
  .index('org_invitation_status_idx', ['status'])
  .index('org_invitation_expires_idx', ['expires_at']);

export const organizationSchemaV2: ReauthSchemaPlugin = {
  tables: {
    organizations: organizations,
    organization_memberships: organizationMemberships,
    organization_invitations: organizationInvitations,
  },
  relations: {},
};