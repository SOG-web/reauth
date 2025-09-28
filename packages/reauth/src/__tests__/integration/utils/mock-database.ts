import type { FumaClient, OrmLike } from '../../../types';

/**
 * Mock database implementation for testing
 * Provides in-memory storage and basic query operations
 */
export class MockDatabase implements OrmLike {
  private tables = new Map<string, Map<string, any>>();
  private autoIncrement = new Map<string, number>();

  constructor() {
    this.initializeTables();
  }

  private initializeTables() {
    // Initialize common tables used by plugins
    const tableNames = [
      'subjects',
      'credentials',
      'anonymous_sessions',
      'api_keys',
      'verification_codes',
      'password_reset_codes',
      'usernames',
      'phone_numbers',
      'phone_verification_codes',
      'passwordless_tokens',
      'sessions',
      'organizations',
      'organization_members',
      'jwks_keys',
    ];

    tableNames.forEach(tableName => {
      this.tables.set(tableName, new Map());
      this.autoIncrement.set(tableName, 1);
    });
  }

  // Basic CRUD operations
  async create<T>(table: string, data: Partial<T>): Promise<T> {
    const tableMap = this.tables.get(table) || new Map();
    
    // Generate ID if not provided
    let id = data.id || this.generateId(table);
    
    const record = {
      id,
      created_at: new Date(),
      updated_at: new Date(),
      ...data,
    } as T;

    tableMap.set(id.toString(), record);
    this.tables.set(table, tableMap);
    
    return record;
  }

  async findFirst<T>(table: string, options?: {
    where?: (builder: any) => any;
    select?: string[];
    include?: any;
  }): Promise<T | null> {
    const tableMap = this.tables.get(table);
    if (!tableMap) return null;

    const records = Array.from(tableMap.values());
    
    if (!options?.where) {
      return records[0] as T || null;
    }

    // Simple where clause simulation
    const mockBuilder = this.createMockBuilder(records);
    try {
      options.where(mockBuilder);
      const filtered = mockBuilder.getResults();
      return filtered[0] as T || null;
    } catch {
      // If where clause fails, return null
      return null;
    }
  }

  async findMany<T>(table: string, options?: {
    where?: (builder: any) => any;
    select?: string[];
    include?: any;
    orderBy?: any;
    limit?: number;
  }): Promise<T[]> {
    const tableMap = this.tables.get(table);
    if (!tableMap) return [];

    let records = Array.from(tableMap.values());
    
    if (options?.where) {
      const mockBuilder = this.createMockBuilder(records);
      try {
        options.where(mockBuilder);
        records = mockBuilder.getResults();
      } catch {
        // If where clause fails, return empty array
        return [];
      }
    }

    if (options?.limit) {
      records = records.slice(0, options.limit);
    }

    return records as T[];
  }

  async update<T>(table: string, id: string | number, data: Partial<T>): Promise<T | null> {
    const tableMap = this.tables.get(table);
    if (!tableMap) return null;

    const existing = tableMap.get(id.toString());
    if (!existing) return null;

    const updated = {
      ...existing,
      ...data,
      updated_at: new Date(),
    } as T;

    tableMap.set(id.toString(), updated);
    return updated;
  }

  async delete(table: string, id: string | number): Promise<boolean> {
    const tableMap = this.tables.get(table);
    if (!tableMap) return false;

    return tableMap.delete(id.toString());
  }

  async deleteMany(table: string, options?: {
    where?: (builder: any) => any;
  }): Promise<number> {
    const tableMap = this.tables.get(table);
    if (!tableMap) return 0;

    let records = Array.from(tableMap.entries());
    let deletedCount = 0;
    
    if (options?.where) {
      const mockBuilder = this.createMockBuilder(records.map(([_, record]) => record));
      try {
        options.where(mockBuilder);
        const toDelete = mockBuilder.getResults();
        
        for (const record of toDelete) {
          if (tableMap.delete(record.id?.toString())) {
            deletedCount++;
          }
        }
      } catch {
        // If where clause fails, delete nothing
        return 0;
      }
    } else {
      deletedCount = tableMap.size;
      tableMap.clear();
    }

    return deletedCount;
  }

  async count(table: string, options?: {
    where?: (builder: any) => any;
  }): Promise<number> {
    const tableMap = this.tables.get(table);
    if (!tableMap) return 0;

    let records = Array.from(tableMap.values());
    
    if (options?.where) {
      const mockBuilder = this.createMockBuilder(records);
      try {
        options.where(mockBuilder);
        records = mockBuilder.getResults();
      } catch {
        // If where clause fails, return 0
        return 0;
      }
    }

    return records.length;
  }

  private createMockBuilder(records: any[]) {
    let filteredRecords = records;

    const builder = (field: string, operator: string, value: any) => {
      filteredRecords = filteredRecords.filter(record => {
        const fieldValue = record[field];
        
        switch (operator) {
          case '=':
            return fieldValue === value;
          case '!=':
            return fieldValue !== value;
          case '>':
            return fieldValue > value;
          case '>=':
            return fieldValue >= value;
          case '<':
            return fieldValue < value;
          case '<=':
            return fieldValue <= value;
          case 'in':
            return Array.isArray(value) && value.includes(fieldValue);
          case 'like':
            return typeof fieldValue === 'string' && fieldValue.includes(value);
          default:
            return true;
        }
      });
      
      return builder; // Chain support
    };

    builder.getResults = () => filteredRecords;
    
    return builder;
  }

  private generateId(table: string): string {
    const current = this.autoIncrement.get(table) || 1;
    this.autoIncrement.set(table, current + 1);
    return `${table}_${current}`;
  }

  // Utility methods for testing
  clearTable(table: string): void {
    this.tables.set(table, new Map());
    this.autoIncrement.set(table, 1);
  }

  clearAllTables(): void {
    this.tables.clear();
    this.autoIncrement.clear();
    this.initializeTables();
  }

  getTableData(table: string): any[] {
    const tableMap = this.tables.get(table);
    return tableMap ? Array.from(tableMap.values()) : [];
  }

  insertTestData(table: string, data: any[]): void {
    const tableMap = this.tables.get(table) || new Map();
    
    data.forEach(record => {
      const id = record.id || this.generateId(table);
      const fullRecord = {
        id,
        created_at: new Date(),
        updated_at: new Date(),
        ...record,
      };
      tableMap.set(id.toString(), fullRecord);
    });
    
    this.tables.set(table, tableMap);
  }
}

/**
 * Create a mock FumaClient that returns the MockDatabase as ORM
 */
export function createMockDatabase(): FumaClient {
  const mockDb = new MockDatabase();

  return {
    async version(): Promise<string> {
      return 'mock-1.0.0';
    },
    orm(version: string): OrmLike {
      return mockDb;
    },
  };
}

/**
 * Get direct access to the mock database for test setup
 */
export function getMockDatabase(client: FumaClient): MockDatabase {
  return client.orm('mock-1.0.0') as MockDatabase;
}