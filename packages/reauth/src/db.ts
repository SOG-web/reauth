import { fumadb } from 'fumadb';
import type { ReauthSchemaPlugin } from './types';
import buildSchema from './base.schema';

/**
 * Create a ReAuth schema version with plugins.
 *
 * @example
 * ```ts
 * const { schema: v1, plugins: v1Plugins } = reauthDb('1.0.1', [emailPasswordSchema, jwtSchema, sessionSchema]);
 * ```
 *
 * @param version - Semantic version string (e.g., '1.0.1')
 * @param plugins - Array of schema plugins to include
 * @returns An object containing the schema and plugins array: { schema, plugins }
 */
export const reauthDb = (
  version: string,
  plugins: ReauthSchemaPlugin[] = [],
) => {
  const schema = buildSchema(version, plugins);
  return {
    schema,
    plugins,
  };
};

export const reauthDbVersions = (schemas: any[]) => {
  return fumadb({
    namespace: 'reauth',
    schemas,
  });
};

/**
 * Extend an existing schema version with additional plugin schemas.
 *
 * @example
 * ```ts
 * const { schema: v1, plugins: v1Plugins } = reauthDb('1.0.1', [emailPasswordSchema, jwtSchema, sessionSchema]);
 * const { schema: v2, plugins: v2Plugins } = extendSchemaVersion(v1Plugins, '1.0.2', [usernamePasswordSchema, anonymousSchema]);
 * const { schema: v3, plugins: v3Plugins } = extendSchemaVersion(v2Plugins, '1.0.3', [apiKeySchema]);
 * ```
 *
 * @param basePlugins - The plugins array from the previous version
 * @param newVersion - The version string for the new schema
 * @param additionalSchemas - Array of new plugin schemas to add to the base version
 * @returns An object containing the new schema and combined plugins array: { schema, plugins }
 */
export const extendSchemaVersion = (
  basePlugins: ReauthSchemaPlugin[],
  newVersion: string,
  additionalSchemas: ReauthSchemaPlugin[] = [],
) => {
  const allSchemas = [...basePlugins, ...additionalSchemas];

  const newSchema = buildSchema(newVersion, allSchemas);
  return { schema: newSchema, plugins: allSchemas };
};
