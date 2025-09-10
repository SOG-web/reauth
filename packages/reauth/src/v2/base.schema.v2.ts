import { schema, table, column, idColumn } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../types';
import { sessionsV2 } from './session.schema.v2';

/**
 * Build the V2 Fuma schema by combining:
 * - Core V2 tables (sessionsV2)
 * - Plugin-provided tables and relations
 *
 * Note: V2 ignores extendTables to prevent shared-entity coupling.
 */
export default function buildSchemaV2(plugins: ReauthSchemaPlugin[] = []) {
  // Core V2 tables shared across all providers
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
  }).unique('identities_provider_identifier_uk', ['identifier']);
  // gather plugin tables
  const pluginTables = plugins
    .map((p) => p.tables ?? {})
    .reduce((acc, t) => Object.assign(acc, t), {} as Record<string, any>);

  const tables = {
    sessions: sessionsV2,
    subjects,
    credentials,
    identities,
    ...pluginTables,
  } as Record<string, any>;

  // gather and merge plugin relations (no core cross-plugin relations in V2)
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
