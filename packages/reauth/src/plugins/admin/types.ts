export interface AdminConfig {
  // Role configuration
  adminRole: string;
  availableRoles: string[];

  // Audit logging
  enableAuditLogging: boolean;
  auditLogRetentionDays: number;

  // Security settings
  requireMfaForAdmin: boolean;
  maxAdminSessionDuration: number;

  // User management permissions
  allowAdminCreateUser: boolean;
  allowAdminDeleteUser: boolean;

  // Rate limiting
  rateLimitPerHour: number;

  // Ban configuration - controls which ban reasons still allow access
  banConfig?: {
    // Ban reasons that still allow limited access (e.g., 'warning', 'temporary')
    allowedReasons?: string[];
    // Whether banned users can access specific plugins/steps
    allowedPlugins?: string[];
    allowedSteps?: string[];
  };

  // Additional permissions
  customPermissions?: Record<string, string[]>;
}

export interface AdminAction {
  action: string;
  actorId: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface AdminUser {
  id: string;
  email?: string;
  username?: string;
  roles: string[];
  permissions: string[];
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface RoleAssignment {
  subjectId: string;
  role: string;
  permissions: string[];
  assignedBy: string;
  assignedAt: Date;
  expiresAt?: Date;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}
