import type { OrganizationConfigV2 } from './types';
import type { OrmLike } from '../../types.v2';

/**
 * Generate a unique organization slug from name
 */
export const generateOrganizationSlug = (name: string): string => {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  // Add a random suffix to ensure uniqueness
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  
  return `${baseSlug}-${timestamp}${random}`;
};

/**
 * Generate a secure invitation token
 */
export const generateInvitationToken = (): string => {
  const timestamp = Date.now().toString(36);
  const random1 = Math.random().toString(36).substring(2, 12);
  const random2 = Math.random().toString(36).substring(2, 12);
  
  return `inv_${timestamp}_${random1}_${random2}`;
};

/**
 * Calculate expiration date for invitations
 */
export const calculateInvitationExpiry = (config?: OrganizationConfigV2): Date => {
  const ttlDays = config?.invitationTtlDays || 7; // Default 7 days
  return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
};

/**
 * Check if user has permission to perform action in organization
 */
export const hasOrganizationPermission = async (
  subjectId: string,
  organizationId: string,
  requiredRole: string | string[],
  orm: OrmLike
): Promise<boolean> => {
  const membership = await orm.findFirst('organization_memberships', {
    where: (b: any) =>
      b.and(
        b('subject_id', '=', subjectId),
        b('organization_id', '=', organizationId),
        b('status', '=', 'active')
      ),
  });

  if (!membership) return false;

  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return allowedRoles.includes((membership as any).role);
};

/**
 * Get organization hierarchy (children) for a given organization
 */
export const getOrganizationChildren = async (
  organizationId: string,
  orm: OrmLike
): Promise<any[]> => {
  return await orm.findMany('organizations', {
    where: (b: any) =>
      b.and(
        b('parent_id', '=', organizationId),
        b('is_active', '=', true)
      ),
  }) || [];
};

/**
 * Get organization hierarchy (parent chain) for a given organization
 */
export const getOrganizationParents = async (
  organizationId: string,
  orm: OrmLike
): Promise<any[]> => {
  const parents: any[] = [];
  let currentId = organizationId;

  while (currentId) {
    const org = await orm.findFirst('organizations', {
      where: (b: any) => b('id', '=', currentId),
    });

    if (!org || !org.parent_id) break;
    
    const parent = await orm.findFirst('organizations', {
      where: (b: any) => b('id', '=', org.parent_id),
    });

    if (parent) {
      parents.push(parent);
      currentId = (parent as any).parent_id;
    } else {
      break;
    }
  }

  return parents;
};

/**
 * Check if organization slug is available
 */
export const isSlugAvailable = async (
  slug: string,
  excludeId?: string,
  orm?: OrmLike
): Promise<boolean> => {
  if (!orm) return true; // Assume available if no ORM provided

  const existing = await orm.findFirst('organizations', {
    where: (b: any) => {
      const slugCondition = b('slug', '=', slug);
      
      if (excludeId) {
        return b.and(slugCondition, b('id', '!=', excludeId));
      }
      
      return slugCondition;
    },
  });

  return !existing;
};

/**
 * Clean up expired organization invitations and related data
 * Following the anonymous plugin cleanup pattern
 */
export const cleanupExpiredInvitations = async (
  orm: OrmLike,
  config?: OrganizationConfigV2
): Promise<{ 
  expiredInvitationsDeleted: number; 
  revokedInvitationsDeleted: number;
  errors?: string[] 
}> => {
  const now = new Date();
  const invitationRetentionDays = config?.invitationRetentionDays || 30; // Default 30 days
  const revokedRetentionDays = config?.revokedInvitationRetentionDays || 7; // Default 7 days
  const batchSize = config?.cleanupBatchSize || 100;

  const invitationCutoffDate = new Date(now.getTime() - invitationRetentionDays * 24 * 60 * 60 * 1000);
  const revokedCutoffDate = new Date(now.getTime() - revokedRetentionDays * 24 * 60 * 60 * 1000);

  let expiredInvitationsDeleted = 0;
  let revokedInvitationsDeleted = 0;
  const errors: string[] = [];

  try {
    // Step 1: Delete expired invitations that are past retention period
    const expiredResult = await (orm as any).deleteMany('organization_invitations', {
      where: (b: any) =>
        b.and(
          b.or(
            b.and(b('status', '=', 'expired'), b('created_at', '<', invitationCutoffDate)),
            b.and(b('status', '=', 'pending'), b('expires_at', '<', now), b('created_at', '<', invitationCutoffDate))
          )
        ),
      limit: batchSize,
    });

    expiredInvitationsDeleted = typeof expiredResult === 'number' ? expiredResult : 0;

    // Step 2: Delete old revoked invitations
    const revokedResult = await (orm as any).deleteMany('organization_invitations', {
      where: (b: any) =>
        b.and(
          b('status', '=', 'revoked'),
          b('created_at', '<', revokedCutoffDate)
        ),
      limit: batchSize,
    });

    revokedInvitationsDeleted = typeof revokedResult === 'number' ? revokedResult : 0;

    // Step 3: Update status of expired pending invitations (don't delete immediately)
    await (orm as any).updateMany('organization_invitations', {
      where: (b: any) =>
        b.and(
          b('status', '=', 'pending'),
          b('expires_at', '<', now)
        ),
      set: {
        status: 'expired',
        updated_at: now,
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Cleanup failed: ${errorMessage}`);
  }

  return {
    expiredInvitationsDeleted,
    revokedInvitationsDeleted,
    ...(errors.length > 0 && { errors }),
  };
};

/**
 * Clean up expired organization memberships (if they have expiration dates)
 */
export const cleanupExpiredMemberships = async (
  orm: OrmLike,
  config?: OrganizationConfigV2
): Promise<{ membershipsDeleted: number; errors?: string[] }> => {
  const now = new Date();
  const batchSize = config?.cleanupBatchSize || 100;
  const errors: string[] = [];
  let membershipsDeleted = 0;

  try {
    // Delete memberships that have expired
    const result = await (orm as any).deleteMany('organization_memberships', {
      where: (b: any) =>
        b.and(
          b('expires_at', '!=', null),
          b('expires_at', '<', now),
          b('status', '!=', 'suspended') // Don't delete suspended memberships automatically
        ),
    });

    membershipsDeleted = typeof result === 'number' ? result : 0;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Membership cleanup failed: ${errorMessage}`);
  }

  return {
    membershipsDeleted,
    ...(errors.length > 0 && { errors }),
  };
};

/**
 * Validate organization role against available roles
 */
export const isValidRole = (role: string, config?: OrganizationConfigV2): boolean => {
  const availableRoles = config?.availableRoles || ['admin', 'member', 'viewer'];
  return availableRoles.includes(role);
};

/**
 * Check if user can create more organizations
 */
export const canCreateOrganization = async (
  subjectId: string,
  orm: OrmLike,
  config?: OrganizationConfigV2
): Promise<boolean> => {
  const maxOrgs = config?.maxOrganizationsPerUser;
  if (!maxOrgs) return true; // No limit set

  const count = await orm.count('organization_memberships', {
    where: (b: any) =>
      b.and(
        b('subject_id', '=', subjectId),
        b('role', '=', 'admin'), // Only count orgs where user is admin
        b('status', '=', 'active')
      ),
  });

  const userOrgCount = typeof count === 'number' ? count : 0;
  return userOrgCount < maxOrgs;
};