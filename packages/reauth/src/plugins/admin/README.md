# Admin Plugin

The Admin Plugin provides comprehensive user management, role-based access control, and administrative functionality for the ReAuth engine. It enables system administrators to manage users, roles, permissions, and system-wide access policies.

## Overview

The Admin Plugin is a powerful administrative toolkit that provides:

- **User Management**: Create, update, delete, and list users
- **Role-Based Access Control (RBAC)**: Assign and revoke roles with granular permissions
- **User Bans**: Ban and unban users with configurable restrictions
- **Audit Logging**: Track all administrative actions with detailed logs
- **System Status**: Monitor system health and metrics
- **First Admin Setup**: Create the initial administrator account
- **Access Restrictions**: Control which plugins/steps require admin access
- **Universal Hooks**: Automatic enforcement of ban policies and access restrictions

## Installation & Setup

```bash
npm install @re-auth/reauth
```

### Basic Configuration

```typescript
import createReAuthEngine from '@re-auth/reauth';
import { adminPlugin } from '@re-auth/reauth/plugins/admin';
import { emailPasswordPlugin } from '@re-auth/reauth/plugins/email-password';
import { usernamePasswordPlugin } from '@re-auth/reauth/plugins/username';

const engine = createReAuthEngine({
  dbClient: yourDbClient,
  plugins: [
    // Required: Email or username plugin for user creation
    emailPasswordPlugin({
      sessionTtlSeconds: 3600,
      enableRegistration: true,
    }),

    // Admin plugin
    adminPlugin({
      // Role configuration
      adminRole: 'admin',
      availableRoles: ['admin', 'moderator', 'user'],

      // Audit logging
      enableAuditLogging: true,
      auditLogRetentionDays: 90,

      // Security settings
      requireMfaForAdmin: true,
      maxAdminSessionDuration: 3600, // 1 hour

      // User management permissions
      allowAdminCreateUser: true,
      allowAdminDeleteUser: true,

      // Rate limiting
      rateLimitPerHour: 100,

      // First admin setup
      allowFirstAdminSetup: true,
      firstAdminSetupKey: 'your-secret-setup-key', // Optional

      // Access restrictions
      accessRestrictions: {
        adminOnlyPlugins: ['admin'],
        adminOnlySteps: ['email-password.reset-password'],
        allowedRoles: ['admin', 'moderator'],
      },

      // Ban configuration
      banConfig: {
        allowedReasons: ['warning'],
        allowedSteps: ['session.logout'],
        allowedPlugins: [],
      },

      // Custom permissions per role
      customPermissions: {
        admin: ['*'],
        moderator: ['user.view', 'user.update'],
        user: ['profile.view', 'profile.update'],
      },
    }),
  ],
  getUserData: async (subjectId, orm) => {
    const user = await orm.findFirst('subjects', {
      where: (b) => b('id', '=', subjectId),
    });
    return user ?? {};
  },
});
```

## Configuration Reference

### AdminConfig Interface

```typescript
interface AdminConfig {
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

  // Access restrictions - controls which plugins/steps require admin access
  accessRestrictions?: {
    adminOnlyPlugins?: string[];
    adminOnlySteps?: string[];
    allowedRoles?: string[];
  };

  // First admin setup
  allowFirstAdminSetup?: boolean;
  firstAdminSetupKey?: string;

  // Ban configuration
  banConfig?: {
    allowedReasons?: string[];
    allowedPlugins?: string[];
    allowedSteps?: string[];
  };

  // Additional permissions
  customPermissions?: Record<string, string[]>;

  // Root hooks
  rootHooks?: RootStepHooks<AdminConfig>;
}
```

### Configuration Options

| Option                    | Type       | Default                          | Description                                |
| ------------------------- | ---------- | -------------------------------- | ------------------------------------------ |
| `adminRole`               | `string`   | `'admin'`                        | The primary admin role name                |
| `availableRoles`          | `string[]` | `['admin', 'moderator', 'user']` | List of available roles in the system      |
| `enableAuditLogging`      | `boolean`  | `true`                           | Enable comprehensive audit logging         |
| `auditLogRetentionDays`   | `number`   | `90`                             | How long to keep audit logs (days)         |
| `requireMfaForAdmin`      | `boolean`  | `true`                           | Require MFA for admin operations           |
| `maxAdminSessionDuration` | `number`   | `3600`                           | Max admin session duration (seconds)       |
| `allowAdminCreateUser`    | `boolean`  | `true`                           | Allow admins to create users               |
| `allowAdminDeleteUser`    | `boolean`  | `true`                           | Allow admins to delete users               |
| `rateLimitPerHour`        | `number`   | `100`                            | Rate limit for admin operations per hour   |
| `allowFirstAdminSetup`    | `boolean`  | `true`                           | Enable first admin setup                   |
| `firstAdminSetupKey`      | `string?`  | `undefined`                      | Optional setup key for additional security |

## Database Schema

The Admin Plugin adds the following database tables:

### `subject_roles`

Role assignments for users with expiration and revocation support.

```sql
CREATE TABLE subject_roles (
  id VARCHAR(255) PRIMARY KEY,
  subject_id VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL,
  permissions JSON,
  assigned_by VARCHAR(255),
  assigned_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP,
  revoked_by VARCHAR(255),
  revoked_reason VARCHAR(1000),
  metadata JSON,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(subject_id, role)
);
```

### `user_bans`

User ban records with expiration and lift tracking.

```sql
CREATE TABLE user_bans (
  id VARCHAR(255) PRIMARY KEY,
  subject_id VARCHAR(255) NOT NULL,
  banned_by VARCHAR(255) NOT NULL,
  ban_type VARCHAR(50) DEFAULT 'temporary',
  reason VARCHAR(1000) NOT NULL,
  duration_seconds INTEGER,
  expires_at TIMESTAMP,
  lifted_at TIMESTAMP,
  lifted_by VARCHAR(255),
  lifted_reason VARCHAR(1000),
  metadata JSON,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(subject_id)
);
```

### `audit_logs`

Comprehensive audit trail for all administrative actions.

```sql
CREATE TABLE audit_logs (
  id VARCHAR(255) PRIMARY KEY,
  actor_id VARCHAR(255) NOT NULL,
  action VARCHAR(255) NOT NULL,
  target_type VARCHAR(255),
  target_id VARCHAR(255),
  details JSON,
  ip_address VARCHAR(45),
  user_agent VARCHAR(1000),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Extended `subjects` Table

The plugin extends the subjects table with admin-specific fields:

```sql
ALTER TABLE subjects ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE subjects ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE subjects ADD COLUMN deleted_by VARCHAR(255);
ALTER TABLE subjects ADD COLUMN deleted_reason VARCHAR(1000);
ALTER TABLE subjects ADD COLUMN last_login_at TIMESTAMP;
```

## Available Steps

The Admin Plugin provides 11 administrative steps:

### 1. Setup First Admin

**Step:** `setup-first-admin`  
**HTTP:** `POST /admin/setup-first-admin`  
**Auth:** Not required (only works when no admins exist)

Create the initial administrator account.

```typescript
const result = await engine.executeStep('admin', 'setup-first-admin', {
  email: 'admin@example.com',
  password: 'SecurePassword123!',
  setupKey: 'your-secret-key', // Optional
  adminRole: 'admin',
  metadata: {
    fullName: 'System Administrator',
    department: 'IT',
  },
});
```

### 2. Create User

**Step:** `create-user`  
**HTTP:** `POST /admin/create-user`  
**Auth:** Required (admin role)

Create a new user account with optional roles.

```typescript
const result = await engine.executeStep('admin', 'create-user', {
  token: adminToken,
  email: 'user@example.com',
  password: 'UserPassword123!',
  roles: ['user'],
  sendWelcomeEmail: true,
  skipVerification: false,
  metadata: { department: 'Sales' },
});
```

### 3. Update User

**Step:** `update-user`  
**HTTP:** `PUT /admin/update-user`  
**Auth:** Required (admin role)

Update user account details.

```typescript
const result = await engine.executeStep('admin', 'update-user', {
  token: adminToken,
  userId: 'user-123',
  email: 'new-email@example.com',
  username: 'newusername',
  isActive: true,
  metadata: { updatedBy: 'admin' },
});
```

### 4. Delete User

**Step:** `delete-user`  
**HTTP:** `DELETE /admin/delete-user`  
**Auth:** Required (admin role)

Delete a user account (soft or hard delete).

```typescript
const result = await engine.executeStep('admin', 'delete-user', {
  token: adminToken,
  userId: 'user-123',
  reason: 'Account closure requested',
  hardDelete: false, // Soft delete by default
  metadata: { deletedBy: 'admin' },
});
```

### 5. List Users

**Step:** `list-users`  
**HTTP:** `GET /admin/list-users`  
**Auth:** Required (admin role)

List users with filtering and pagination.

```typescript
const result = await engine.executeStep('admin', 'list-users', {
  token: adminToken,
  page: 1,
  limit: 20,
  search: 'john',
  role: 'user',
  status: 'active', // 'active' | 'inactive' | 'banned' | 'all'
  sortBy: 'created_at',
  sortOrder: 'desc',
});
```

### 6. Assign Role

**Step:** `assign-role`  
**HTTP:** `POST /admin/assign-role`  
**Auth:** Required (admin role)

Assign a role to a user with optional expiration.

```typescript
const result = await engine.executeStep('admin', 'assign-role', {
  token: adminToken,
  userId: 'user-123',
  role: 'moderator',
  permissions: ['user.view', 'user.update'],
  expiresAt: '2024-12-31T23:59:59Z', // Optional expiration
  reason: 'Promoted to moderator',
  metadata: { assignedBy: 'admin' },
});
```

### 7. Revoke Role

**Step:** `revoke-role`  
**HTTP:** `DELETE /admin/revoke-role`  
**Auth:** Required (admin role)

Revoke a role from a user.

```typescript
const result = await engine.executeStep('admin', 'revoke-role', {
  token: adminToken,
  userId: 'user-123',
  role: 'moderator',
  reason: 'No longer needed',
  metadata: { revokedBy: 'admin' },
});
```

### 8. Ban User

**Step:** `ban-user`  
**HTTP:** `POST /admin/ban-user`  
**Auth:** Required (admin role)

Ban a user account temporarily or permanently.

```typescript
const result = await engine.executeStep('admin', 'ban-user', {
  token: adminToken,
  userId: 'user-123',
  reason: 'Terms of service violation',
  duration: 86400, // 24 hours in seconds (for temporary bans)
  banType: 'temporary', // 'temporary' | 'permanent'
  metadata: { bannedBy: 'admin' },
});
```

### 9. Unban User

**Step:** `unban-user`  
**HTTP:** `POST /admin/unban-user`  
**Auth:** Required (admin role)

Unban a user account.

```typescript
const result = await engine.executeStep('admin', 'unban-user', {
  token: adminToken,
  userId: 'user-123',
  reason: 'Appeal approved',
  restoreActiveStatus: true,
  metadata: { unbannedBy: 'admin' },
});
```

### 10. View Audit Logs

**Step:** `view-audit-logs`  
**HTTP:** `GET /admin/view-audit-logs`  
**Auth:** Required (admin role)

View audit logs with filtering and pagination.

```typescript
const result = await engine.executeStep('admin', 'view-audit-logs', {
  token: adminToken,
  page: 1,
  limit: 50,
  actorId: 'admin-123',
  action: 'ban_user',
  targetType: 'subject',
  dateFrom: '2024-01-01T00:00:00Z',
  dateTo: '2024-12-31T23:59:59Z',
  sortBy: 'created_at',
  sortOrder: 'desc',
});
```

### 11. System Status

**Step:** `system-status`  
**HTTP:** `GET /admin/system-status`  
**Auth:** Required (admin role)

Get system status and metrics.

```typescript
const result = await engine.executeStep('admin', 'system-status', {
  token: adminToken,
  includeDatabaseStats: true,
  includePluginStatus: true,
  includeSessionStats: true,
});
```

## Universal Hooks

The Admin Plugin registers two universal hooks that run for all plugins and steps:

### 1. Ban Check Hook

Automatically blocks banned users from accessing the system.

**Hook Type:** `before` (universal)  
**Purpose:** Enforce user bans across all authentication flows

**Configuration:**

```typescript
banConfig: {
  allowedReasons: ['warning'], // Ban reasons that still allow access
  allowedPlugins: ['session'], // Plugins banned users can access
  allowedSteps: ['session.logout'], // Specific steps banned users can access
}
```

**Behavior:**

- Checks if user has an active ban
- Compares ban reason against `allowedReasons`
- Checks if current plugin/step is in `allowedPlugins`/`allowedSteps`
- Blocks access if user is banned and not allowed

### 2. Access Restriction Hook

Enforces admin-only access to configured plugins and steps.

**Hook Type:** `before` (universal)  
**Purpose:** Control which operations require admin privileges

**Configuration:**

```typescript
accessRestrictions: {
  adminOnlyPlugins: ['admin', 'organization'], // Plugins requiring admin access
  adminOnlySteps: ['email-password.reset-password'], // Specific steps requiring admin access
  allowedRoles: ['admin', 'moderator'], // Roles that can access restricted resources
}
```

**Behavior:**

- Checks if current plugin/step is restricted
- Validates user has one of the allowed roles
- Blocks access if user lacks required permissions

## Session Resolvers

The plugin registers a custom session resolver for admin subjects:

```typescript
engine.registerSessionResolver('admin-subject', {
  async getById(id: string, orm) {
    const subject = await orm.findFirst('subjects', {
      where: (b) => b('id', '=', id),
    });

    if (!subject) return null;

    // Check if user has admin role
    const adminRole = await orm.findFirst('subject_roles', {
      where: (b) => b.and(b('subject_id', '=', id), b('role', '=', 'admin')),
    });

    return adminRole ? subject : null;
  },
  sanitize(subject: any) {
    // Remove sensitive admin data
    const { isAdmin, ...sanitized } = subject;
    return sanitized;
  },
});
```

## Background Cleanup

The plugin registers a cleanup task for expired audit logs:

```typescript
engine.registerCleanupTask({
  name: 'expired-audit-logs',
  pluginName: 'admin',
  intervalMs: cleanupIntervalMs, // Based on auditLogRetentionDays
  enabled: true,
  runner: async (orm) => {
    const result = await cleanupExpiredAuditLogs(orm, config);
    return {
      cleaned: result.deletedCount,
      auditLogsDeleted: result.deletedCount,
    };
  },
});
```

## Profile API

The plugin exposes a `getProfile` method for retrieving admin user details:

```typescript
const profile = await engine.getUnifiedProfile('admin-123');

// profile.plugins['admin']
{
  isAdmin: true,
  role: 'admin',
  permissions: ['*'],
  recentActions: [
    {
      id: 'log-123',
      action: 'ban_user',
      targetType: 'subject',
      details: { userId: 'user-123', reason: 'spam' },
    },
  ],
}
```

## Utility Functions

The plugin provides utility functions for common operations:

### `cleanupExpiredAuditLogs(orm, config)`

Removes audit logs older than the retention period.

### `getAdminPermissions(orm, subjectId, config)`

Retrieves admin permissions for a user.

### `logAdminAction(orm, action, config)`

Logs an administrative action to the audit trail.

## Error Handling

The plugin uses standardized error codes:

| Code  | Description                             |
| ----- | --------------------------------------- |
| `unf` | Unauthenticated (no valid session)      |
| `aut` | Unauthorized (insufficient permissions) |
| `ic`  | Invalid input (validation errors)       |
| `nf`  | Not found (user/resource doesn't exist) |
| `du`  | Duplicate (user already exists)         |
| `su`  | Success                                 |

## Security Considerations

### 1. First Admin Protection

- Only works when no admin users exist
- Optional setup key for additional security
- Self-assigned admin role to prevent privilege escalation

### 2. Role Expiration

- Roles can have expiration dates
- Automatic cleanup of expired roles
- Audit trail for role changes

### 3. Ban Enforcement

- Universal ban checking across all plugins
- Configurable ban exceptions
- Automatic session invalidation for banned users

### 4. Audit Logging

- All admin actions are logged
- Configurable retention period
- Automatic cleanup of old logs

### 5. Access Restrictions

- Fine-grained control over plugin/step access
- Role-based restrictions
- Universal enforcement

## Complete Example

Here's a complete example of setting up and using the Admin Plugin:

```typescript
import createReAuthEngine from '@re-auth/reauth';
import { adminPlugin } from '@re-auth/reauth/plugins/admin';
import { emailPasswordPlugin } from '@re-auth/reauth/plugins/email-password';

const engine = createReAuthEngine({
  dbClient: yourDbClient,
  plugins: [
    emailPasswordPlugin({
      sessionTtlSeconds: 3600,
      enableRegistration: true,
    }),

    adminPlugin({
      adminRole: 'admin',
      availableRoles: ['admin', 'moderator', 'user'],
      enableAuditLogging: true,
      auditLogRetentionDays: 90,
      allowFirstAdminSetup: true,
      firstAdminSetupKey: 'super-secret-key',
      accessRestrictions: {
        adminOnlyPlugins: ['admin'],
        adminOnlySteps: ['email-password.reset-password'],
        allowedRoles: ['admin', 'moderator'],
      },
      banConfig: {
        allowedReasons: ['warning'],
        allowedSteps: ['session.logout'],
      },
      customPermissions: {
        admin: ['*'],
        moderator: ['user.view', 'user.update', 'ban.*'],
        user: ['profile.*'],
      },
    }),
  ],
  getUserData: async (subjectId, orm) => {
    const user = await orm.findFirst('subjects', {
      where: (b) => b('id', '=', subjectId),
    });
    return user ?? {};
  },
});

// 1. Create first admin
const adminResult = await engine.executeStep('admin', 'setup-first-admin', {
  email: 'admin@company.com',
  password: 'AdminPassword123!',
  setupKey: 'super-secret-key',
  adminRole: 'admin',
});

// 2. Create regular users
const userResult = await engine.executeStep('admin', 'create-user', {
  token: adminResult.token,
  email: 'user@company.com',
  password: 'UserPassword123!',
  roles: ['user'],
});

// 3. Assign moderator role
const roleResult = await engine.executeStep('admin', 'assign-role', {
  token: adminResult.token,
  userId: userResult.userId,
  role: 'moderator',
  permissions: ['user.view', 'user.update'],
  reason: 'Promoted to moderator',
});

// 4. List users
const listResult = await engine.executeStep('admin', 'list-users', {
  token: adminResult.token,
  page: 1,
  limit: 20,
  status: 'active',
});

// 5. View audit logs
const auditResult = await engine.executeStep('admin', 'view-audit-logs', {
  token: adminResult.token,
  page: 1,
  limit: 50,
  action: 'assign_role',
});
```

## HTTP Adapter Integration

When using HTTP adapters, admin steps are automatically exposed:

```http
POST /admin/setup-first-admin     → admin:setup-first-admin
POST /admin/create-user           → admin:create-user (auth)
PUT  /admin/update-user           → admin:update-user (auth)
DELETE /admin/delete-user         → admin:delete-user (auth)
GET  /admin/list-users            → admin:list-users (auth)
POST /admin/assign-role           → admin:assign-role (auth)
DELETE /admin/revoke-role         → admin:revoke-role (auth)
POST /admin/ban-user              → admin:ban-user (auth)
POST /admin/unban-user            → admin:unban-user (auth)
GET  /admin/view-audit-logs       → admin:view-audit-logs (auth)
GET  /admin/system-status         → admin:system-status (auth)
```

## Next Steps

- [Email Password Plugin](../email-password/README.md) - User authentication
- [Organization Plugin](../organization/README.md) - Multi-tenancy
- [Session Plugin](../session/README.md) - Session management
- [Engine Configuration](../../configuration.md) - Engine setup
- [HTTP Adapters](../../../http-adapters/overview.md) - HTTP integration
