import type { TableSchemaV2 } from './types.v2';

// Session schema for V2 architecture
export const sessionsSchema: TableSchemaV2 = {
  name: 'sessions',
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
    token: {
      type: 'string',
      nullable: false,
      unique: true,
    },
    expires_at: {
      type: 'timestamp',
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