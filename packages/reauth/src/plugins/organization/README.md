# Organization Plugin

The Organization plugin extends ReAuth with multi-tenant organization capabilities, allowing users to create, join, and manage organizations with role-based permissions.

## Features

- ✅ **Organization Management**: Create, update, and delete organizations
- ✅ **Member Management**: Add, remove, and update organization members
- ✅ **Role-Based Access**: Flexible role and permission system
- ✅ **Team Support**: Organize members into teams within organizations
- ✅ **Session Enhancement**: Automatically inject organization data into user sessions
- ✅ **Database Migration**: Complete database schema generation

## Installation

The organization plugin is part of the `@re-auth/reauth` package and depends on the admin plugin.

```bash
npm install @re-auth/reauth
```

## Dependencies

The organization plugin requires the following plugins to be installed first:

- `admin` plugin - For user permission management

## Database Schema

The plugin creates two tables:

### Organizations Table
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT UUID(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Organization Members Table
```sql
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT UUID(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  permissions JSON,
  teams JSON,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, entity_id)
);
```

## Basic Usage

### 1. Setup

```typescript
import { createReAuthEngine } from '@re-auth/reauth';
import emailPasswordAuth from '@re-auth/reauth/plugins/email-password';
import adminPlugin from '@re-auth/reauth/plugins/admin';
import { organizationPlugin, KnexOrgService } from '@re-auth/reauth/plugins/organization';

const knex = // your knex instance
const orgService = new KnexOrgService(knex);

const reAuth = createReAuthEngine({
  plugins: [
    emailPasswordAuth({
      verifyEmail: false,
      sendCode: async (entity, code, email, type) => {
        // Your email sending logic
      },
    }),
    adminPlugin({
      adminEntity: yourAdminEntityService,
    }),
    organizationPlugin({
      orgService,
      defaultRole: 'member',
      defaultPermissions: ['read'],
      allowOrgCreation: true,
      maxOrganizations: 10,
    }),
  ],
  entity: entityService,
  session: sessionService,
});
```

### 2. Configuration Options

```typescript
interface OrgConfig {
  orgService: OrgService;
  defaultRole?: string;              // Default: 'member'
  defaultPermissions?: string[];     // Default: []
  maxOrganizations?: number;         // Default: unlimited
  allowOrgCreation?: boolean;        // Default: true
}
```

## API Steps

### create-organization

Creates a new organization with the authenticated user as owner.

**Inputs:**
- `name` (string, required): Organization name
- `description` (string, required): Organization description

**Example:**
```typescript
const result = await reAuth.executeStep('organization', 'create-organization', {
  name: 'Acme Corp',
  description: 'A software company',
  entity: authenticatedUser,
  token: userToken,
});
```

**HTTP Protocol:**
- Method: `POST`
- Auth: Required
- Success: 201
- Error codes: 400 (invalid input), 403 (creation not allowed), 401 (unauthorized)

### join-organization

Adds a user to an existing organization.

**Inputs:**
- `organization_id` (string, required): Organization ID to join
- `role` (string, optional): Role in the organization (defaults to config.defaultRole)
- `permissions` (string[], optional): Permissions array (defaults to config.defaultPermissions)

**Example:**
```typescript
const result = await reAuth.executeStep('organization', 'join-organization', {
  organization_id: 'org-123',
  role: 'developer',
  permissions: ['read', 'write', 'deploy'],
  entity: authenticatedUser,
  token: userToken,
});
```

**HTTP Protocol:**
- Method: `POST`
- Auth: Required
- Success: 200
- Error codes: 400 (invalid input), 404 (org not found), 409 (already member), 401 (unauthorized)

### get-organizations

Retrieves all organizations the authenticated user belongs to.

**Inputs:** None (uses authenticated user from entity/token)

**Example:**
```typescript
const result = await reAuth.executeStep('organization', 'get-organizations', {
  entity: authenticatedUser,
  token: userToken,
});

// result.organizations contains array of user's organizations with roles
```

**HTTP Protocol:**
- Method: `GET`
- Auth: Required
- Success: 200
- Error codes: 400 (error), 401 (unauthorized)

## Advanced Usage

### Custom Service Implementation

You can implement your own `OrgService` instead of using `KnexOrgService`:

```typescript
import { OrgService, Organization, OrganizationMember } from '@re-auth/reauth/plugins/organization';

class CustomOrgService implements OrgService {
  async createOrganization(org: Partial<Organization>): Promise<Organization> {
    // Your implementation
  }

  async findOrganization(id: string): Promise<Organization | null> {
    // Your implementation
  }

  // ... implement all methods
}
```

### Session Enhancement

The plugin automatically enhances user sessions with organization data:

```typescript
// After authentication, the entity object includes:
{
  id: 'user-123',
  email: 'user@example.com',
  // ... other user fields
  organizations: [
    {
      id: 'org-1',
      name: 'Acme Corp',
      role: 'developer',
      permissions: ['read', 'write']
    }
  ],
  teams: ['frontend-team', 'api-team']
}
```

### Role-Based Access Control

Use the enhanced session data for authorization:

```typescript
// Express middleware example
function requireOrgRole(organizationId: string, requiredRole: string) {
  return (req, res, next) => {
    const user = req.user; // From authentication middleware
    
    const membership = user.organizations?.find(org => org.id === organizationId);
    if (!membership || !hasRequiredRole(membership.role, requiredRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

// Usage
app.delete('/organizations/:id', 
  requireOrgRole(req.params.id, 'admin'),
  deleteOrganizationHandler
);
```

### Teams and Permissions

Organizations support nested teams and granular permissions:

```typescript
// Adding a user to specific teams with custom permissions
await reAuth.executeStep('organization', 'join-organization', {
  organization_id: 'org-123',
  role: 'developer',
  permissions: ['repo:read', 'repo:write', 'deploy:staging'],
  teams: ['frontend-team', 'mobile-team'],
  entity: user,
  token: token,
});
```

## HTTP Adapter Integration

When using HTTP adapters, the organization routes are automatically created:

```typescript
// Express example
import { createExpressAdapter } from '@re-auth/http-adapters/express';

const adapter = createExpressAdapter(reAuth);
app.use('/auth', adapter.getRouter());

// Routes available:
// POST /auth/organization/create-organization
// POST /auth/organization/join-organization  
// GET  /auth/organization/get-organizations
```

## Error Handling

The plugin provides specific error statuses:

- `unauthorized` (401): User not authenticated
- `forbidden` (403): Action not allowed (creation disabled, max orgs reached)
- `not_found` (404): Organization not found
- `conflict` (409): User already member of organization
- `error` (400): General errors (validation, database issues)

## Migration Notes

When upgrading from older versions of the organization plugin:

1. The plugin now requires the admin plugin as a dependency
2. Database schema includes proper foreign key constraints
3. Session enhancement is automatic (no manual setup needed)
4. Legacy `OrgUser` type is maintained for backward compatibility

## Testing

```typescript
import { describe, it, expect } from 'vitest';
import organizationPlugin from '@re-auth/reauth/plugins/organization';

describe('Organization Plugin', () => {
  it('should create organization successfully', async () => {
    const result = await reAuth.executeStep('organization', 'create-organization', {
      name: 'Test Org',
      description: 'Test Description',
      entity: mockUser,
      token: mockToken,
    });

    expect(result.success).toBe(true);
    expect(result.organization.name).toBe('Test Org');
  });
});
```

## Troubleshooting

### Common Issues

1. **"orgService is missing" error**
   - Ensure you provide a valid `OrgService` implementation in the plugin config

2. **"depends on admin plugin" error**
   - Make sure the admin plugin is installed and configured before the organization plugin

3. **Database migration issues**
   - Ensure your database supports the required column types (UUID, JSON)
   - Check foreign key constraints are properly set up

4. **Session enhancement not working**
   - Verify the session service is properly configured
   - Check that organization data exists in the database

### Performance Considerations

- Use database indexes on frequently queried columns (entity_id, organization_id)
- Consider caching organization membership for high-traffic applications
- Use pagination for large organization member lists

## Contributing

The organization plugin is part of the ReAuth monorepo. See the main README for contribution guidelines. 