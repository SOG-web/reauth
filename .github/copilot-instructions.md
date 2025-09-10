# ReAuth - GitHub Copilot Instructions

ReAuth is a **runtime, framework, and protocol-independent** authentication engine for TypeScript/JavaScript applications. It provides a universal authentication solution with a plugin-based architecture that works across all JS runtimes and frameworks through protocol-specific adapters.

**Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Bootstrap and Build the Repository

**CRITICAL: NEVER CANCEL builds or long-running commands. Set appropriate timeouts.**

```bash
# Install pnpm globally (required)
npm install -g pnpm

# Install dependencies - takes ~40 seconds
pnpm install --no-frozen-lockfile

# Build core packages ONLY (recommended) - takes ~15 seconds
pnpm --filter "@re-auth/*" build

# Build ALL packages (WARNING: currently fails on web app) - takes ~20 seconds when it works
# NEVER CANCEL: Set timeout to 120+ seconds
pnpm build
```

### Run Tests

```bash
# Run tests for core packages - takes ~2 seconds
cd packages/reauth && pnpm test

# NOTE: Some tests fail due to work-in-progress features (organization plugin)
# 24/25 tests pass, 1 fails with known "not ready for production" error
```

### Linting and Type Checking

```bash
# Type check core packages (works reliably)
cd packages/reauth && pnpm lint

# Check types across all packages (fails on web app currently)
pnpm check-types

# Format code (currently fails due to syntax error in test file)
# pnpm format
```

### Development Servers

```bash
# WARNING: hono-test app currently has import/export issues
# cd apps/hono-test && pnpm dev

# Web app (Next.js) - has TypeScript compilation errors
# cd apps/web && pnpm dev
```

## Validation

### Manual Testing Scenarios

**ALWAYS manually validate any changes to core packages by:**

1. **Build Validation**: Run `pnpm --filter "@re-auth/*" build` and ensure all packages compile successfully (~15 seconds)
2. **Test Validation**: Run `cd packages/reauth && pnpm test` and ensure 24+ tests pass (~2 seconds)
   - Expected: 24 passed, 1 failed (organization plugin work-in-progress)
   - Tests run despite 1 known syntax error in email-password test file
3. **Type Validation**: Run `cd packages/reauth && pnpm lint` for TypeScript checking (~4 seconds)
4. **Watch Mode Test**: Run `cd packages/reauth && pnpm dev` to test development watch mode

### Complete Validation Workflow

**Run this complete sequence after making any changes:**

```bash
# Full validation sequence - takes ~25 seconds total
cd /home/runner/work/reauth/reauth

# Step 1: Build all core packages (15s)
pnpm --filter "@re-auth/*" build

# Step 2: Run tests (2s) 
cd packages/reauth && pnpm test

# Step 3: Type check (4s)
pnpm lint

# Step 4: Return to repo root
cd /home/runner/work/reauth/reauth
```

**Expected Results:**
- Build: All 3 packages (@re-auth/reauth, @re-auth/http-adapters, @re-auth/sdk-generator) build successfully
- Tests: 24 tests pass, 1 test fails with "organizationPlugin name" assertion error (expected)
- Types: No TypeScript errors in core package

### Git and Development Workflow

```bash
# Check current repository status
git status

# The repository uses conventional commits and changesets
# For package changes, create a changeset:
pnpm changeset

# Standard development workflow:
git checkout -b feature/your-feature-name
# Make changes to core packages
pnpm --filter "@re-auth/*" build  # Build
cd packages/reauth && pnpm test   # Test  
cd ../.. && git add .
git commit -m "feat: your changes"
```

### Working Components vs Issues

**✅ WORKS RELIABLY:**
- Core ReAuth packages build and compile successfully
- Core package tests run (with 1 known failure)
- TypeScript validation on core packages
- Package dependency management
- Turborepo build caching

**⚠️ KNOWN ISSUES:**
- Web app (apps/web) has TypeScript compilation errors - builds fail
- Hono test app (apps/hono-test) has import/export issues - runtime fails
- Some test files have syntax errors causing formatter to fail
- Full repository lint fails on some packages
- Organization plugin is work-in-progress and throws "not ready" errors

## Common Tasks

### Core Package Development

```bash
# Build only core authentication packages
pnpm --filter "@re-auth/*" build

# Test core functionality
cd packages/reauth && pnpm test

# Watch mode for core development
cd packages/reauth && pnpm dev
```

### Expected Command Timing

- **pnpm install**: ~40 seconds
- **Core packages build**: ~15 seconds - NEVER CANCEL, set timeout to 120+ seconds
- **Full build**: ~20 seconds (when working) - NEVER CANCEL, set timeout to 180+ seconds
- **Test suite**: ~2 seconds
- **Type checking**: ~5 seconds

### Repository Structure

```
├── packages/
│   ├── reauth/              # Core protocol-agnostic authentication engine
│   ├── http-adapters/       # HTTP protocol adapters for web frameworks
│   ├── sdk-generator/       # TypeScript client SDK generator
│   ├── eslint-config/       # Shared ESLint configuration
│   ├── typescript-config/   # Shared TypeScript configuration
│   └── ui/                  # Shared React components
├── apps/
│   ├── hono-test/          # Backend HTTP integration example (has issues)
│   └── web/                # Next.js frontend example (has issues)
└── .github/
    └── workflows/
        └── deploy-packages.yml  # CI/CD pipeline for npm publishing
```

### Key Package Dependencies

- **Node.js**: >= 18 (development requirement, but ReAuth works in all JS runtimes)
- **pnpm**: Required package manager (version 9.0.0+)
- **TypeScript**: 5.8.2
- **Turborepo**: 2.5.3+ for monorepo builds
- **Vitest**: For testing framework

### Architecture Overview

ReAuth follows a clean separation of concerns with three distinct layers:

1. **Core Engine** (`@re-auth/reauth`): Protocol-agnostic authentication logic
2. **Protocol Adapters** (`@re-auth/http-adapters`): Protocol-specific implementations 
3. **Framework Integrations**: Framework-specific adapters (Express, Fastify, Hono)

### Publishing and CI

```bash
# Release workflow (automated via GitHub Actions)
pnpm changeset version && pnpm changeset publish

# Generate SDK from HTTP introspection
pnpm generate:sdk
```

### Critical Development Guidelines

1. **Always build core packages before testing changes**: `pnpm --filter "@re-auth/*" build`
2. **Focus on core package development**: The core packages are stable and working
3. **Avoid the example apps until fixed**: Both hono-test and web apps have current issues
4. **Use appropriate timeouts**: Builds can take 15-60+ seconds, never cancel prematurely
5. **Test incrementally**: Run `cd packages/reauth && pnpm test` after changes
6. **Validate TypeScript**: Run `cd packages/reauth && pnpm lint` for type checking

### Frequently Used Commands Output

```bash
# Repository root contents
$ ls -la
.changeset/          packages/           
.github/             pnpm-lock.yaml      
.gitignore           pnpm-workspace.yaml 
LICENSE              README.md           
apps/                turbo.json          
biome.json           tt.json             
package.json         

# Core packages
$ ls packages/
eslint-config/  http-adapters/  reauth/  sdk-generator/  typescript-config/  ui/

# Working build command
$ pnpm --filter "@re-auth/*" build
# Output: 3 packages build successfully in ~15 seconds
```

### SDK Generation

```bash
# Generate TypeScript client SDK (requires running server)
pnpm --filter=@re-auth/sdk-generator build && node packages/sdk-generator/dist/index.js --url http://localhost:3001/test-introspection --output apps/web/lib/reauth-client --client axios --key key
```

### Troubleshooting

**If builds fail:**
1. Ensure pnpm is installed globally
2. Run `pnpm install --no-frozen-lockfile`
3. Focus on core packages: `pnpm --filter "@re-auth/*" build`

**If tests fail:**
1. Expected: 24 pass, 1 fail (organization plugin)
2. Syntax errors in test files prevent some tests from running
3. Focus on core functionality tests

**If development servers fail:**
1. Use core package watch mode: `cd packages/reauth && pnpm dev`
2. Avoid running example apps until import/export issues are resolved