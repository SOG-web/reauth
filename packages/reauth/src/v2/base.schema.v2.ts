import type { TableSchemaV2 } from './types.v2';

// Base database schemas for V2 architecture - shared credentials model
export const subjectsSchema: TableSchemaV2 = {
  name: 'subjects',
  columns: {
    id: {
      type: 'uuid',
      primary: true,
      nullable: false,
      unique: true,
    },
    role: {
      type: 'string',
      nullable: false,
    },
    created_at: {
      type: 'timestamp',
      nullable: false,
    },
    updated_at: {
      type: 'timestamp',
      nullable: false,
    },
  },
};

export const credentialsSchema: TableSchemaV2 = {
  name: 'credentials',
  columns: {
    id: {
      type: 'uuid',
      primary: true,
      nullable: false,
      unique: true,
    },
    subject_id: {
      type: 'uuid',
      nullable: false,
      unique: true,
      references: {
        table: 'subjects',
        column: 'id',
      },
    },
    password_hash: {
      type: 'text',
      nullable: false,
    },
    created_at: {
      type: 'timestamp',
      nullable: false,
    },
    updated_at: {
      type: 'timestamp',
      nullable: false,
    },
  },
};

export const identitiesSchema: TableSchemaV2 = {
  name: 'identities',
  columns: {
    id: {
      type: 'uuid',
      primary: true,
      nullable: false,
      unique: true,
    },
    subject_id: {
      type: 'uuid',
      nullable: false,
      references: {
        table: 'subjects',
        column: 'id',
      },
    },
    provider: {
      type: 'string',
      nullable: false,
    },
    identifier: {
      type: 'string',
      nullable: false,
    },
    verified: {
      type: 'boolean',
      nullable: false,
    },
    created_at: {
      type: 'timestamp',
      nullable: false,
    },
    updated_at: {
      type: 'timestamp',
      nullable: false,
    },
  },
  constraints: [
    {
      type: 'unique',
      columns: ['provider', 'identifier'],
    },
  ],
};

export const baseSchemas: TableSchemaV2[] = [
  subjectsSchema,
  credentialsSchema,
  identitiesSchema,
];