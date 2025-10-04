# Schema Versioning Guide

This guide explains how to create and manage schema versions in ReAuth.

## Overview

ReAuth uses a versioning system that allows you to incrementally add new authentication methods (plugins) to your database schema over time. This is useful for:

- Gradually rolling out new authentication features
- Maintaining backward compatibility
- Managing database migrations

## Creating Schema Versions

### Basic Usage with `reauthDb`

Create a schema version using `reauthDb`, which returns both the schema and plugins:

```typescript
import { reauthDb } from '@re-auth/reauth';
import { emailPasswordSchema } from '@re-auth/reauth/plugins/email-password';
import { jwtSchema } from '@re-auth/reauth/services';
import { sessionSchema } from '@re-auth/reauth/plugins/session';

const { schema: v1, plugins: v1Plugins } = reauthDb('1.0.1', [emailPasswordSchema, jwtSchema, sessionSchema]);
```

### Extended Usage with `extendSchemaVersion` (Recommended)

The `extendSchemaVersion` function allows you to create new versions by extending existing ones, without repeating all schemas:

```typescript
import { reauthDb, extendSchemaVersion } from '@re-auth/reauth';
import { usernamePasswordSchema } from '@re-auth/reauth/plugins/username';
import { anonymousSchema } from '@re-auth/reauth/plugins/anonymous';
import { phonePasswordSchema } from '@re-auth/reauth/plugins/phone';
import { apiKeySchema } from '@re-auth/reauth/plugins/api-key';

// Create base version
const { schema: v1, plugins: v1Plugins } = reauthDb('1.0.1', [emailPasswordSchema, jwtSchema, sessionSchema]);

// Extend v1 to create v2 - only specify NEW schemas
// Pass v1Plugins (not v1 schema) to extendSchemaVersion
const { schema: v2, plugins: v2Plugins } = extendSchemaVersion(v1Plugins, '1.0.2', [usernamePasswordSchema, anonymousSchema, phonePasswordSchema]);

// Continue extending for v3
const { schema: v3, plugins: v3Plugins } = extendSchemaVersion(v2Plugins, '1.0.3', [apiKeySchema]);
```

## Benefits of `extendSchemaVersion`

1. **Less Repetition**: You don't need to list all schemas again when creating new versions
2. **Clearer Intent**: It's obvious which schemas are being added in each version
3. **Fewer Errors**: Reduces the chance of forgetting to include a schema from a previous version
4. **Better Maintenance**: Easier to track what changed between versions
5. **Type Safety**: The plugins array is tracked and passed explicitly, making the extension chain clear

## Complete Example

```typescript
import { reauthDb, extendSchemaVersion, reauthDbVersions } from '@re-auth/reauth';
import { kyselyAdapter } from 'fumadb/adapters/kysely';
import { emailPasswordSchema } from '@re-auth/reauth/plugins/email-password';
import { jwtSchema } from '@re-auth/reauth/services';
import { sessionSchema } from '@re-auth/reauth/plugins/session';
import { usernamePasswordSchema } from '@re-auth/reauth/plugins/username';
import { anonymousSchema } from '@re-auth/reauth/plugins/anonymous';
import { phonePasswordSchema } from '@re-auth/reauth/plugins/phone';
import { apiKeySchema } from '@re-auth/reauth/plugins/api-key';

// Version 1.0.1 - Initial release with basic authentication
const { schema: v1, plugins: v1Plugins } = reauthDb('1.0.1', [emailPasswordSchema, jwtSchema, sessionSchema]);

// Version 1.0.2 - Add alternative authentication methods
// Pass the plugins array from v1, not the schema
const { schema: v2, plugins: v2Plugins } = extendSchemaVersion(v1Plugins, '1.0.2', [usernamePasswordSchema, anonymousSchema, phonePasswordSchema]);

// Version 1.0.3 - Add API key authentication
const { schema: v3, plugins: v3Plugins } = extendSchemaVersion(v2Plugins, '1.0.3', [apiKeySchema]);

// Register all versions - use the schema objects, not the plugins
export const factory = reauthDbVersions([v1, v2, v3]);

// Create database client
export const client = factory.client(
  kyselyAdapter({
    provider: 'sqlite',
    db: kysely,
  }),
);
```

## API Reference

### `reauthDb(version: string, plugins: ReauthSchemaPlugin[])`

Creates a new schema version with the specified plugins.

**Parameters:**

- `version` - Semantic version string (e.g., '1.0.1')
- `plugins` - Array of schema plugins to include

**Returns:** `{ schema, plugins }` - An object containing:

- `schema` - The FumaDB schema object
- `plugins` - The plugins array (used for extending versions)

### `extendSchemaVersion(basePlugins, newVersion, additionalSchemas)`

Extends an existing schema version with additional plugins.

**Parameters:**

- `basePlugins` - The plugins array from a previous version (e.g., `v1Plugins`)
- `newVersion` - Version string for the new schema (e.g., '1.0.2')
- `additionalSchemas` - Array of new plugin schemas to add

**Returns:** `{ schema, plugins }` - An object containing:

- `schema` - The new FumaDB schema object with combined plugins
- `plugins` - The combined plugins array (for further extending)

### `reauthDbVersions(schemas: Schema[])`

Registers multiple schema versions for migration management.

**Parameters:**

- `schemas` - Array of schema objects (e.g., `[v1, v2, v3]`)

**Returns:** FumaDB factory for creating database clients

## Migration Strategy

When you create a new schema version:

1. The database will automatically track which version is currently active
2. FumaDB will generate migrations to add the new tables/columns
3. Existing data is preserved and compatible with the new schema
4. You can roll back to previous versions if needed

## Best Practices

1. **Use Semantic Versioning**: Follow semver conventions (major.minor.patch)
2. **Incremental Changes**: Add schemas incrementally rather than in large batches
3. **Test Migrations**: Always test schema migrations in a non-production environment first
4. **Document Changes**: Keep track of what each version adds or changes
5. **Use `extendSchemaVersion`**: Prefer `extendSchemaVersion` over `buildSchema` for new versions
