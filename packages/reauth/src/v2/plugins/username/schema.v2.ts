import type { TableSchemaV2 } from '../../types.v2';

// Username-specific provider metadata table (minimal since no verification)
export const usernameIdentitiesSchema: TableSchemaV2 = {
  name: 'username_identities',
  columns: {
    id: {
      type: 'uuid',
      primary: true,
      nullable: false,
      unique: true,
    },
    identity_id: {
      type: 'uuid',
      nullable: false,
      unique: true,
      references: {
        table: 'identities',
        column: 'id',
      },
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