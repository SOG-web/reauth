export interface OrganizationConfig {
  // Organization limits
  maxOrganizationsPerUser?: number; // Limit orgs per user
  allowHierarchy?: boolean; // Enable parent/child relationships

  // Default settings
  defaultRole?: string; // Default role for new members
  availableRoles?: string[]; // Allowed organization roles

  // Invitation settings
  invitationTtlDays?: number; // How long invitations are valid

  // Cleanup configuration (following anonymous plugin pattern)
  cleanupIntervalMinutes?: number; // Default: 120 (every 2 hours)

  useEmailPlugin: boolean;
  getEmail?: (email: string) => Promise<string>;
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
  invitation_token: string; // Invitation token
  token: string; // Authentication required
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
  subject_id?: string;
  email?: string;
}

export interface RemoveMemberOutput {
  success: boolean;
  message: string;
  status: string;
}

export interface ChangeMemberRoleInput {
  token: string; // Authentication required
  organization_id: string;
  subject_id?: string;
  email?: string;
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

export interface SetRolesPermissionsInput {
  token: string; // Authentication required
  organization_id: string;
  subject_id?: string;
  email?: string;
  roles?: string[]; // Array of role names to set
  permissions?: string[]; // Array of permission names to set
  remove_roles?: string[]; // Array of role names to remove
  remove_permissions?: string[]; // Array of permission names to remove
}

export interface SetRolesPermissionsOutput {
  success: boolean;
  message: string;
  status: string;
  membership?: {
    id: string;
    subject_id: string;
    organization_id: string;
    roles: string[];
    permissions: string[];
    updated_at: string;
  };
}

export interface GetRolesPermissionsInput {
  token: string; // Authentication required
  organization_id: string;
  subject_id?: string;
  email?: string;
}

export interface GetRolesPermissionsOutput {
  success: boolean;
  message: string;
  status: string;
  membership?: {
    id: string;
    subject_id: string;
    organization_id: string;
    roles: string[];
    permissions: string[];
    role: string; // The main role
    email: string;
  };
}
