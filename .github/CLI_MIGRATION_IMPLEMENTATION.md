# ReAuth CLI Migration Tool - Implementation Summary

## Overview

Implemented a CLI tool embedded in the `@re-auth/reauth` package that allows users to run database migrations without writing custom migration code. The CLI dynamically imports the user's client configuration and runs FumaDB migrations.

## What Was Implemented

### 1. CLI Tool (`packages/reauth/src/cli/index.ts`)

A Node.js CLI script that:

- Accepts a `--client` flag with the path to the user's client file
- Dynamically imports the client file using ES module imports
- Extracts the exported `client` variable
- Passes it to FumaDB's `createCli` function
- Runs migrations automatically

**Key Features:**

- Works with TypeScript files (requires `tsx` or similar runtime)
- Works with JavaScript ES modules
- Supports both relative and absolute paths
- Clear error messages if the client export is not found
- Optional `--command` flag for custom command names

### 2. Package Configuration Updates

**`package.json`:**

- Added `bin` field pointing to the CLI: `"reauth-migrate": "./dist/cli/index.js"`
- This makes the command available globally after installation

**`tsup.config.ts`:**

- Added `src/cli/index.ts` to the entry points
- Ensures the CLI is built along with the package

### 3. Documentation

**Created `CLI_MIGRATION.md`:**

- Complete usage guide
- Installation instructions
- Requirements and troubleshooting
- Examples for different package managers
- Integration with package.json scripts

**Updated `README.md`:**

- Added CLI migration section
- Shows how to run migrations with the CLI
- Links to detailed documentation

**Updated `apps/hono-test/README.md`:**

- Added migration setup instructions
- Updated installation steps to include migrations

### 4. Example App Updates

**`apps/hono-test/package.json`:**

- Added `migrate` script: `"migrate": "tsx ../node_modules/@re-auth/reauth/dist/cli/index.js --client ./src/reauth/auth.ts"`

**`apps/hono-test/src/index.ts`:**

- Removed manual migration code
- Removed imports for `runMigrations` and `client`
- Cleaner server setup

**Deleted/Deprecated:**

- `apps/hono-test/src/mi.ts` is no longer needed (can be deleted)

## How It Works

### User's Setup

1. **Create auth configuration with exported client:**

```typescript
// src/reauth/auth.ts
import { reauthDb, extendSchemaVersion, reauthDbVersions } from '@re-auth/reauth';
import { kyselyAdapter } from 'fumadb/adapters/kysely';

const { schema: v1, plugins: v1Plugins } = reauthDb('1.0.1', [...]);
const { schema: v2, plugins: v2Plugins } = extendSchemaVersion(v1Plugins, '1.0.2', [...]);

export const factory = reauthDbVersions([v1, v2]);
export const client = factory.client(kyselyAdapter({ ... })); // Must export this!
```

2. **Add migration script to package.json:**

```json
{
  "scripts": {
    "migrate": "reauth-migrate --client ./src/reauth/auth.ts"
  }
}
```

3. **Run migrations:**

```bash
pnpm migrate
```

### What Happens

1. The CLI receives the path to the client file
2. It resolves the absolute path and converts it to a file URL
3. It dynamically imports the module
4. It looks for the `client` export (tries multiple patterns)
5. It passes the client to FumaDB's CLI
6. FumaDB reads the current database version
7. FumaDB generates and runs migrations for any new schema versions

## Benefits

### For Users

1. **No Boilerplate**: Don't need to write migration code
2. **Simple Command**: Just point to your client file
3. **Type Safe**: Works with TypeScript files
4. **Integrated**: Part of the core package, no extra dependencies
5. **Flexible**: Works with any file structure

### For Developers

1. **Consistent**: Everyone uses the same migration approach
2. **Documented**: Clear documentation and examples
3. **Maintainable**: Migration logic is centralized in the CLI
4. **Framework Independent**: Works regardless of which framework they use

## Usage Examples

### Basic Usage

```bash
npx reauth-migrate --client ./src/reauth/auth.ts
```

### With Package Manager

```bash
pnpm reauth-migrate --client ./src/reauth/auth.ts
yarn reauth-migrate --client ./src/reauth/auth.ts
```

### With Custom Command Name

```bash
npx reauth-migrate --client ./src/reauth/auth.ts --command my-app-migrate
```

### In Package.json Scripts

```json
{
  "scripts": {
    "migrate": "reauth-migrate --client ./src/reauth/auth.ts",
    "migrate:dev": "tsx node_modules/@re-auth/reauth/dist/cli/index.js --client ./src/reauth/auth.ts"
  }
}
```

### For TypeScript Projects

```bash
# Option 1: Use tsx to run TypeScript directly
tsx node_modules/@re-auth/reauth/dist/cli/index.js --client ./src/auth.ts

# Option 2: Build first, then migrate
npm run build && reauth-migrate --client ./dist/auth.js
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                User's Application                          │
│                                                             │
│  src/reauth/auth.ts                                        │
│  ├─ Schema versions (v1, v2, v3)                           │
│  ├─ Factory: reauthDbVersions([v1, v2, v3])              │
│  └─ export const client = factory.client(adapter)         │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Dynamic Import
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                ReAuth CLI                                   │
│           (reauth-migrate command)                         │
│                                                             │
│  1. Parse --client argument                                │
│  2. Resolve absolute path                                  │
│  3. Import module dynamically                              │
│  4. Extract client export                                  │
│  5. Pass to FumaDB CLI                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                FumaDB CLI                                   │
│           (createCli from fumadb/cli)                      │
│                                                             │
│  1. Read current database version                          │
│  2. Compare with registered schema versions                │
│  3. Generate migration SQL                                 │
│  4. Execute migrations                                     │
│  5. Update version table                                   │
└─────────────────────────────────────────────────────────────┘
```

## Requirements for User's Client File

The client file must:

1. **Export a `client` variable**:

   ```typescript
   export const client = factory.client(adapter);
   ```

2. **Be importable as an ES module**:
   - Use `export` statements
   - Have proper module resolution

3. **Have all dependencies installed**:
   - The CLI will execute the file, so all imports must resolve

## Testing

To test the CLI:

1. Build the reauth package:

   ```bash
   cd packages/reauth && pnpm build
   ```

2. Run the CLI from an app:

   ```bash
   cd apps/hono-test
   pnpm migrate
   ```

3. Verify migrations run successfully

## Future Enhancements

Potential improvements:

1. **Support for CommonJS**: Add support for `require()` syntax
2. **Config File**: Support for a `reauth.config.js` file
3. **Multiple Clients**: Support for multiple database clients in one project
4. **Dry Run**: Add a `--dry-run` flag to preview migrations
5. **Rollback**: Add rollback functionality
6. **Status Command**: Show current database version and pending migrations

## Files Changed

### Created

- `packages/reauth/src/cli/index.ts` - CLI implementation
- `packages/reauth/CLI_MIGRATION.md` - CLI documentation

### Modified

- `packages/reauth/package.json` - Added bin field
- `packages/reauth/tsup.config.ts` - Added CLI to build
- `apps/hono-test/package.json` - Added migrate script
- `apps/hono-test/src/index.ts` - Removed manual migration code
- `apps/hono-test/README.md` - Updated with migration instructions
- `README.md` - Added CLI section to schema versioning

### Can Be Deleted

- `apps/hono-test/src/mi.ts` - No longer needed

## Summary

The ReAuth CLI migration tool provides a simple, integrated way to run database migrations without requiring users to write boilerplate migration code. It works by dynamically importing the user's client configuration and delegating to FumaDB's CLI, providing a seamless experience for managing schema versions.
