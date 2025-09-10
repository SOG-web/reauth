import { randomBytes } from 'crypto';
import type { 
  EntityServiceV2, 
  SubjectV2, 
  IdentityV2, 
  CredentialsV2 
} from './types.v2';

export class EntityServiceV2Impl implements EntityServiceV2 {
  private subjects = new Map<string, SubjectV2>();
  private identities = new Map<string, IdentityV2>();
  private credentials = new Map<string, CredentialsV2>();

  async findSubject(id: string): Promise<SubjectV2 | null> {
    return this.subjects.get(id) || null;
  }

  async createSubject(data: Partial<SubjectV2>): Promise<SubjectV2> {
    const subject: SubjectV2 = {
      id: data.id || this.generateId(),
      role: data.role || 'user',
      created_at: new Date(),
      updated_at: new Date(),
    };

    this.subjects.set(subject.id, subject);
    return subject;
  }

  async findIdentity(provider: string, identifier: string): Promise<IdentityV2 | null> {
    for (const identity of this.identities.values()) {
      if (identity.provider === provider && identity.identifier === identifier) {
        return identity;
      }
    }
    return null;
  }

  async createIdentity(data: Omit<IdentityV2, 'id' | 'created_at' | 'updated_at'>): Promise<IdentityV2> {
    // Check for existing identity with same provider/identifier
    const existing = await this.findIdentity(data.provider, data.identifier);
    if (existing) {
      throw new Error(`Identity with provider '${data.provider}' and identifier '${data.identifier}' already exists`);
    }

    const identity: IdentityV2 = {
      id: this.generateId(),
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    };

    this.identities.set(identity.id, identity);
    return identity;
  }

  async updateIdentity(id: string, data: Partial<IdentityV2>): Promise<IdentityV2> {
    const identity = this.identities.get(id);
    if (!identity) {
      throw new Error(`Identity with id '${id}' not found`);
    }

    const updated = {
      ...identity,
      ...data,
      updated_at: new Date(),
    };

    this.identities.set(id, updated);
    return updated;
  }

  async getCredentials(subject_id: string): Promise<CredentialsV2 | null> {
    for (const credential of this.credentials.values()) {
      if (credential.subject_id === subject_id) {
        return credential;
      }
    }
    return null;
  }

  async setCredentials(subject_id: string, password_hash: string): Promise<CredentialsV2> {
    // Check if credentials already exist for this subject
    const existing = await this.getCredentials(subject_id);
    
    if (existing) {
      // Update existing credentials
      existing.password_hash = password_hash;
      existing.updated_at = new Date();
      this.credentials.set(existing.id, existing);
      return existing;
    } else {
      // Create new credentials
      const credential: CredentialsV2 = {
        id: this.generateId(),
        subject_id,
        password_hash,
        created_at: new Date(),
        updated_at: new Date(),
      };

      this.credentials.set(credential.id, credential);
      return credential;
    }
  }

  private generateId(): string {
    return randomBytes(16).toString('hex');
  }
}