import type { TableSchemaV2 } from '../../types.v2';

// Email-specific provider metadata table
export const emailIdentitiesSchema: TableSchemaV2 = {
  name: 'email_identities',
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
    // Verification codes stored hashed at rest
    verification_code: {
      type: 'text',
      nullable: true,
    },
    verification_code_expires_at: {
      type: 'timestamp',
      nullable: true,
    },
    // Reset codes stored hashed at rest
    reset_code: {
      type: 'text',
      nullable: true,
    },
    reset_code_expires_at: {
      type: 'timestamp',
      nullable: true,
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