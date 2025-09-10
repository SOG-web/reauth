import { column, idColumn, schema, table } from 'fumadb/schema';
import { sessionSchemaPlugin } from './plugins/session/schema';
import { emailPasswordSchema } from './plugins/email-password/schema';
import { ReauthSchemaPlugin } from './types';

const entities = table('entities', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  role: column('role', 'varchar(255)').defaultTo('user'),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
});

// Default plugins
const defaultSchemaPlugins: ReauthSchemaPlugin[] = [
  sessionSchemaPlugin,
  emailPasswordSchema,
];

export default function buildSchema(
  plugins: ReauthSchemaPlugin[] = defaultSchemaPlugins,
) {
  // 1) gather plugin tables
  const pluginTables = plugins
    .map((p) => p.tables ?? {})
    .reduce((acc, t) => Object.assign(acc, t), {} as Record<string, any>);

  // 2) clone core tables' column definitions for merge
  const coreColumnMaps: Record<string, Record<string, any>> = {
    entities: entities.columns,
  };

  // collect plugin extendTables
  const extendTableMaps = plugins
    .map((p) => p.extendTables ?? {})
    .reduce(
      (acc, t) => Object.assign(acc, t),
      {} as Record<string, Record<string, any>>,
    );

  // merge extensions into core columns
  for (const [tableName, columns] of Object.entries(extendTableMaps)) {
    if (!coreColumnMaps[tableName] && !pluginTables[tableName]) {
      // if a plugin tries to extend a non-existent table, create it as plugin table
      coreColumnMaps[tableName] = {};
    }
    coreColumnMaps[tableName] = {
      ...(coreColumnMaps[tableName] ?? {}),
      ...columns,
    };
  }

  // rebuild tables from merged column maps (core + extended), then overlay plugin-provided tables
  const rebuiltTables = Object.fromEntries(
    Object.entries(coreColumnMaps).map(([name, cols]) => [
      name,
      table(name, cols),
    ]),
  );

  const tables = { ...rebuiltTables, ...pluginTables };

  const relationLists: Record<
    string,
    Array<(b: any) => Record<string, unknown>>
  > = {};
  for (const p of plugins) {
    for (const [tableName, factory] of Object.entries(p.relations ?? {})) {
      (relationLists[tableName] ||= []).push(factory);
    }
  }

  const relations = Object.fromEntries(
    Object.entries(relationLists).map(([tableName, factories]) => [
      tableName,
      (builder: any) => Object.assign({}, ...factories.map((f) => f(builder))),
    ]),
  );

  return schema({
    version: '1.0.0',
    tables,
    relations,
  });
}

// // app setup
// import buildSchema from "reauth/src/base.schema"; // default export returns built schema
// import { auditPlugin } from "external-plugin";

// const schema = buildSchema([auditPlugin]);
// // or merge with defaults:
// const schema = buildSchema([auditPlugin /*, ...other plugins*/]);

// // external-plugin/index.ts
// import { column } from "fumadb/schema";
// import type { ReauthSchemaPlugin } from "reauth/src/types";

// export const entitiesExtPlugin: ReauthSchemaPlugin = {
//   extendTables: {
//     entities: {
//       last_login_at: column("last_login_at", "timestamp"),
//       display_name: column("display_name", "varchar(255)"),
//     },
//   },
//   relations: {
//     // optional: extend relations too
//     entities: ({ many }) => ({ /* ... */ }),
//   },
// };
