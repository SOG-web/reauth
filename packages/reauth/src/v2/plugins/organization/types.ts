export interface OrganizationConfigV2 {
  // Organization limits
  maxOrganizationsPerUser?: number; // Limit orgs per user
  allowHierarchy?: boolean; // Enable parent/child relationships
  
  // Default settings
  defaultRole?: string; // Default role for new members
  availableRoles?: string[]; // Allowed organization roles
  
  // Invitation settings
  invitationTtlDays?: number; // How long invitations are valid
  
  // Cleanup configuration (following anonymous plugin pattern)
  cleanupEnabled?: boolean; // Default: true
  cleanupIntervalMinutes?: number; // Default: 120 (every 2 hours)
  invitationRetentionDays?: number; // How long to keep expired invitations
  cleanupBatchSize?: number; // Process in batches
  revokedInvitationRetentionDays?: number; // How long to keep revoked invitations
}

// Input/Output types for organization steps
export interface CreateOrganizationInput {
  token: string; // Authentication required
  name: string;
  slug?: string; // Auto-generated if not provided
  parent_id?: string; // For hierarchical organizations
  settings?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface CreateOrganizationOutput {
  success: boolean;
  message: string;
  status: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
    parent_id?: string;
    settings?: Record<string, any>;
    metadata?: Record<string, any>;
    created_at: string;
  };
}

export interface InviteMemberInput {
  token: string; // Authentication required
  organization_id: string;
  email: string;
  role: string;
}

export interface InviteMemberOutput {
  success: boolean;
  message: string;
  status: string;
  invitation?: {
    id: string;
    token: string;
    expires_at: string;
  };
}

export interface AcceptInvitationInput {
  token: string; // Invitation token
  user_token?: string; // Optional user authentication token
}

export interface AcceptInvitationOutput {
  success: boolean;
  message: string;
  status: string;
  membership?: {
    id: string;
    organization_id: string;
    role: string;
  };
}

export interface ListOrganizationsInput {
  token: string; // Authentication required
}

export interface ListOrganizationsOutput {
  success: boolean;
  message: string;
  status: string;
  organizations?: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
    parent_id?: string;
    settings?: Record<string, any>;
    metadata?: Record<string, any>;
  }>;
}

export interface GetOrganizationInput {
  token: string; // Authentication required
  organization_id: string;
}

export interface GetOrganizationOutput {
  success: boolean;
  message: string;
  status: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
    parent_id?: string;
    settings?: Record<string, any>;
    metadata?: Record<string, any>;
    role: string; // User's role in this organization
    members?: Array<{
      subject_id: string;
      role: string;
      joined_at: string;
    }>;
  };
}

export interface UpdateOrganizationInput {
  token: string; // Authentication required
  organization_id: string;
  name?: string;
  slug?: string;
  settings?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface UpdateOrganizationOutput {
  success: boolean;
  message: string;
  status: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
    settings?: Record<string, any>;
    metadata?: Record<string, any>;
    updated_at: string;
  };
}

export interface RemoveMemberInput {
  token: string; // Authentication required
  organization_id: string;
  subject_id: string;
}

export interface RemoveMemberOutput {
  success: boolean;
  message: string;
  status: string;
}

export interface ChangeMemberRoleInput {
  token: string; // Authentication required
  organization_id: string;
  subject_id: string;
  role: string;
}

export interface ChangeMemberRoleOutput {
  success: boolean;
  message: string;
  status: string;
  membership?: {
    id: string;
    subject_id: string;
    organization_id: string;
    role: string;
    updated_at: string;
  };
}