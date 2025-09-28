import { schema, table, column, idColumn } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../types';
import { sessions } from './session.schema.';

/**
 * Build the  Fuma schema by combining:
 * - Core  tables (sessions)
 * - Plugin-provided tables and relations
 *
 * Note:  ignores extendTables to prevent shared-entity coupling.
 */
export default function buildSchema(plugins: ReauthSchemaPlugin[] = []) {
  // Core  tables shared across all providers
  const subjects = table('subjects', {
    id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
    created_at: column('created_at', 'timestamp').defaultTo$('now'),
    updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
  });

  const credentials = table('credentials', {
    subject_id: column('subject_id', 'varchar(255)'),
    password_hash: column('password_hash', 'varchar(255)'),
    password_algo: column('password_algo', 'varchar(64)').nullable(),
    password_version: column('password_version', 'integer').nullable(),
    password_updated_at: column('password_updated_at', 'timestamp').nullable(),
    created_at: column('created_at', 'timestamp').defaultTo$('now'),
    updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
  }).unique('credentials_subject_uk', ['subject_id']);

  const identities = table('identities', {
    id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
    subject_id: column('subject_id', 'varchar(255)'),
    provider: column('provider', 'varchar(64)'),
    identifier: column('identifier', 'varchar(255)'),
    verified: column('verified', 'bool').defaultTo(false),
    created_at: column('created_at', 'timestamp').defaultTo$('now'),
    updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
  }).unique('identities_provider_identifier_uk', ['provider', 'identifier']);
  // gather plugin tables
  const pluginTables = plugins
    .map((p) => p.tables ?? {})
    .reduce((acc, t) => Object.assign(acc, t), {} as Record<string, any>);

  // Prevent plugin tables from shadowing core tables
  const coreTableNames = new Set([
    'sessions',
    'subjects',
    'credentials',
    'identities',
  ]);
  const collisions = Object.keys(pluginTables).filter((k) =>
    coreTableNames.has(k),
  );
  if (collisions.length) {
    throw new Error(
      `Plugin table name collision(s) with core tables: ${collisions.join(', ')}`,
    );
  }

  const tables = {
    sessions: sessions,
    subjects,
    credentials,
    identities,
    ...pluginTables,
  } as Record<string, any>;

  // gather and merge plugin relations (no core cross-plugin relations in )
  const relationLists: Record<
    string,
    Array<(b: any) => Record<string, unknown>>
  > = {};
  for (const p of plugins) {
    for (const [tableName, factory] of Object.entries(p.relations ?? {})) {
      (relationLists[tableName] ||= []).push(factory as any);
    }
  }

  const relations = Object.fromEntries(
    Object.entries(relationLists).map(([tableName, factories]) => [
      tableName,
      (builder: any) => Object.assign({}, ...factories.map((f) => f(builder))),
    ]),
  );

  return schema({
    version: '2.0.0',
    tables,
    relations,
  });
}
