# FumaDB Integration Plan for ReAuth

## Executive Summary

- Replace the shared “entity table + EntityService” pattern with FumaDB-based, per-plugin tables and a session-centric cross-plugin access model.
- Keep the core engine protocol-agnostic; HTTP remains in `packages/http-adapters/` unchanged.
- Only the Session plugin can touch data from other plugins, via a registry of plugin-provided subject resolvers. Plugins do not depend on each other.
- Consumers provide their ORM/adapter to a FumaDB client factory; the engine and plugins use FumaDB’s unified schema and query interface.
- Provide a compatibility mode and an adapter for incremental migration away from `EntityService`.
- Enforce performance discipline: strong indices, minimal joins, and clean data access boundaries; split large files to meet the 500-line constraint.

## What Was Reviewed

- Core engine and types in `packages/reauth/src/`:
  - `auth-engine.ts` (core, to be split during implementation)
  - `types.ts` (already imports `fumadb/schema` and defines `ReauthSchemaPlugin`)
  - `db.ts` (introduces `reauthDb` factory that builds a Fuma schema using plugin schema modules)
  - `base.schema.ts` (merges plugin `tables`, `extendTables`, and `relations` into a Fuma schema)
- Session schema plugin: `packages/reauth/src/plugins/session/schema.ts`
- HTTP adapters (protocol implementation): `packages/http-adapters/` (decoupled by design)
- FumaDB docs (Setup, Schema, Query, Versioning, Supported Features)

## Goals and Non-Goals

- Goals
  - Per-plugin tables under FumaDB; eliminate reliance on a shared entity table.
  - No plugin-to-plugin data dependency. Only the Session plugin can resolve subjects across plugins.
  - Replace `EntityService` with FumaDB-driven access; maintain or wrap `SessionService`.
  - Keep `@re-auth/reauth` protocol-agnostic; no direct framework or ORM coupling.
  - Preserve developer extensibility and replaceability of parts.

- Non-Goals
  - Forcing a specific database or ORM: consumers use FumaDB adapters (Prisma, Drizzle in query mode, Kysely/SQL).
  - HTTP changes: `@re-auth/http-adapters` should require no or minimal adjustments.

## Target Architecture

- Core remains protocol-agnostic, using Awilix DI.
- FumaDB integration:
  - `reauthDb()` builds a versioned Fuma schema by aggregating plugin schema modules (already started in `db.ts` and `base.schema.ts`).
  - Consumers construct a Fuma client with their adapter and pass it to ReAuth.
  - The engine registers this client into the container for all plugins.

- Data ownership:
  - Each plugin defines its own tables and relations in a `ReauthSchemaPlugin` export (`tables`, `relations`).
  - Deprecate extending the shared `entities` table via `extendTables` (currently supported) and introduce a compatibility variant for transition.

- Session-centric subject model:
  - Sessions table no longer references `entity_id`. Instead:
    - `subject_type`: the plugin name (e.g., `email-password`, `oauth-google`)
    - `subject_id`: the plugin-specific primary key
    - `token`, `expires_at`, timestamps
  - Session plugin maintains a “subject resolver registry”. Each auth plugin registers a resolver that knows how to fetch its subject by `subject_id`.
  - Only the session plugin queries across plugin tables, honoring the decoupling requirement.

## Data Model and Schema Strategy

- Versioning
  - Adopt FumaDB’s versioned schema pattern (`schema({ version: 'x.y.z', ... })`), with new schema files for breaking changes.
  - Provide a `1.x` “compat variant” that retains `entities` + plugin `extendTables` (for current users), and a `2.x` pure-per-plugin schema (no entity extension).

- Base/core tables (2.x)
  - Prefer no global `entities` table. If needed, keep a small optional `principals` meta table (no plugin fields), but prefer the “subject” approach via session.
  - Sessions table fields:
    - `id` (auto)
    - `subject_type` (varchar, indexed)
    - `subject_id` (varchar, indexed)
    - `token` (unique index)
    - `expires_at` (timestamp)
    - `created_at`, `updated_at`

- Per-plugin tables (2.x)
  - Each plugin defines its own primary table(s) with appropriate indices (e.g., `email` unique index for email/password).
  - Plugins define relations within their namespace. Avoid FKs to other plugins to keep them independent.
  - If a plugin genuinely needs cross-plugin linkage, do it via session subject resolution or optional soft references.

- Indices and performance
  - Sessions: unique index on `token`; composite index `(subject_type, subject_id)`.
  - Plugin tables: index frequent lookup keys (email/username/provider keys).
  - Keep joins minimal; prefer single-table queries and targeted lookups via resolver functions.

## Engine and DI Changes

- Container registration
  - Register the Fuma `dbFactory` and/or a ready `dbClient` in the container (e.g., `cradle.db`), instead of `entityService`.
  - Plugins get their ORM for the active version: `const orm = dbClient.orm(await dbClient.version())`.

- Deprecate `EntityService`
  - Remove `entityService` from `ReAuthCradle` and from `ReAuthEngine` constructor in .
  - Provide a temporary `EntityServiceAdapter` backed by FumaDB for v1/v1-compat so existing plugins continue to work while migrating.

- Keep `SessionService` (but back it with FumaDB)
  - Provide a default `SessionService` implementation (in the session plugin) that uses FumaDB tables.
  - Continue to allow swapping `SessionService` implementations for custom token strategies (JWT, opaque tokens, etc.).
  - `ReAuthEngine` session APIs remain; internally they call the Fuma-backed `SessionService`.

- File organization (respect 500-line rule)
  - Split `auth-engine.ts` into modules:
    - `engine/core.ts` (plugin registration, DI, hooks)
    - `engine/introspection.ts` (subject/table introspection)
    - `engine/sessions.ts` (session hooks and subject validation)
    - `engine/errors.ts` (error types, if not already separated)

## Session Plugin: Cross-Plugin Resolver Contract

- Plugin-facing API (during `initialize(container)`):
  - `container.cradle.sessionResolvers.register(subjectType, { getById, sanitize? })`
    - `subjectType`: plugin name
    - `getById(id, orm) => Promise<Subject | null>` reads via Fuma ORM
    - `sanitize(subject) => safeSubject` strips sensitive fields for serialization

- Session service behavior:
  - On verify: decode token, read `subject_type` + `subject_id`, obtain resolver, fetch and return subject.
  - On create: store `subject_type` + `subject_id` with token and expiry.
  - This ensures only the session plugin can resolve cross-plugin identity.

## Plugin Authoring with FumaDB

- Schema
  - Each plugin exports a `ReauthSchemaPlugin` (supported by `ReauthSchemaPlugin` type and merged by `base.schema.ts`).
  - Prefer `tables` and `relations`.
  - Avoid `extendTables` of core tables in ; keep it only for the v1-compat variant.

- Data access
  - Use Fuma client from container (`dbClient.orm(version)`) inside `AuthStep.run(...)`.
  - Do not query other plugins’ tables. If you need “current subject”, use session APIs and work with the subject your plugin controls.

- Outputs
  - Steps can return their plugin’s subject (formerly returned as `entity`). For compatibility, keep `entity` optional and add `subject` as the canonical field in .
  - Continue to use `getSensitiveFields()` for redaction.

## Introspection Updates

- Replace entity-centric introspection with subject-aware introspection:
  - Include plugin table schemas (field names, types) derived from the merged Fuma schema.
  - Expose a “subjects” map: `{ pluginName -> primary table + id column }`.
  - Keep step metadata as-is (validation schemas, protocol config).

- Implementation notes
  - Move current `getIntrospectionData` and “entity schema” builder into `engine/introspection.ts`.
  - For v1-compat, preserve old “entity schema” reporting.

## Backward Compatibility and Migration

- Two schema variants:
  - v1-compat: keep `entities` + `extendTables` for existing plugins.
  - : pure plugin tables; sessions store `{subject_type, subject_id}`; no entity extension.

- Bridges:
  - `EntityServiceAdapter`: implement `find/create/update/delete` against v1-compat schema or a configurable plugin table for transition. Mark deprecated.
  - Continue exporting current types (`Entity`, `AuthOutput.entity`) in v1-compat. Introduce `Subject` and `AuthOutput.subject` in .

- Consumer migration steps:
  - Provide `reauthDb()` and instruct consumers to create a Fuma client with their adapter (Prisma/Drizzle/Kysely).
  - Offer a CLI/guide to run Fuma’s migration engine (Kysely) or leave migration to their ORM where applicable.
  - One release as v1.x (compat), then with breaking changes.

## HTTP Adapters

- No changes required in routing or protocol mapping.
- Adapters still call `engine.executeStep(...)` and `engine.checkSession(token)`, and set cookies/headers per existing logic.
- Context rules continue to apply (e.g., OAuth state cookies), unaffected by the DB layer.

## Performance and Security

- Performance
  - Index session `token` and `(subject_type, subject_id)`.
  - Unique indices on plugin-specific login keys (e.g., `email`, `(provider, provider_user_id)`).
  - Favor simple queries and avoid cross-plugin joins; the session resolver pattern guarantees bounded queries.

- Security
  - Preserve `getSensitiveFields()` redaction.
  - Ensure session resolver sanitization to avoid leaking secrets from plugin tables.
  - Optional multi-tenant headers/cookies handled at HTTP adapter level (context rules) without data-layer coupling.

## Work Breakdown (PR Plan)

1. Foundation (v1-compat kept)
   - Add Fuma client registration to container (`packages/reauth/src/db.ts` used by engine).
   - Introduce a `DatabaseCradle` entry and start decoupling from `EntityService` where possible without breaking v1-compat.
   - Split `auth-engine.ts` into modules to comply with the 500-line rule.

2. Session
   - Add `sessions` schema with `{subject_type, subject_id}` and indices.
   - Implement `SessionService` backed by Fuma ORM.
   - Implement `sessionResolvers` registry and update `checkSession` path to use it.

3. Plugin conversions
   - Update built-in plugins:
     - `email-password`: own table with `email`, `password_hash`, `email_verified`, indices.
     - `oauth`: tables for providers and links (unique `(provider, provider_user_id)`).
     - Remove use of `extendTables` in ; keep it only in v1-compat.
   - Ensure each registers a subject resolver with the session plugin.

4. Introspection
   - Update to subject-aware introspection.
   - In v1-compat, preserve old “entity schema” reporting.

5. Compatibility bridge
   - Implement `EntityServiceAdapter` using Fuma against v1-compat schema.
   - Document deprecation and migration steps.

6. Docs and Examples
   - Update `ARCHITECTURE.md` to reflect per-plugin tables and session subject model.
   - Update `PLUGIN_DEVELOPMENT.md` with Fuma schema guidance and resolver contract.
   - Add examples for constructing a Fuma client and passing it to ReAuth.

7. Tests
   - Add integration tests using Kysely + SQLite for CI.
   - Session creation/verification across different plugin subjects.
   - HTTP adapters unchanged; test end-to-end with Hono/Express adapters.

## Acceptance Criteria

- Engine compiles and runs with Fuma client provided by consumer.
- All built-in plugins work with their own tables; no cross-plugin table reads except through session resolver.
- Session validation returns correct subject objects for each plugin type.
- HTTP adapters continue to function without modification.
- Introspection includes subject/plugin table schemas.
- v1-compat mode available for incremental upgrades.

## Risks and Mitigations

- Data migration complexity
  - Provide SQL/Kysely migration examples and clear docs.
  - Keep v1-compat schema variant to reduce pressure.

- Plugin ecosystem readiness
  - A transitional `EntityServiceAdapter` buys time.
  - Clear “how to write Fuma schema” guidance and code examples.

- Referential integrity
  - Session uses soft links (`subject_type` + `subject_id`) to avoid inter-plugin FKs; document the trade-off and rely on resolvers.

## Next Steps

- Draft the schema layout for session and one built-in plugin (`email-password`) as a reference.
- Split `auth-engine.ts` into modules to comply with the 500-line rule and wire Fuma client registration.
- Implement the session resolver registry and Fuma-backed `SessionService`, plus the v1-compat bridge.
