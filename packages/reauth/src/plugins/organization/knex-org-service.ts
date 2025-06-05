import { Knex } from 'knex';
import { Organization, OrganizationMember, OrgService, OrgUser } from './org.plugin';

export class KnexOrgService implements OrgService {
  private knex: Knex;
  private organizationsTable: string;
  private membersTable: string;

  constructor(knex: Knex, organizationsTable = 'organizations', membersTable = 'organization_members') {
    this.knex = knex;
    this.organizationsTable = organizationsTable;
    this.membersTable = membersTable;
  }

  // Organization management
  async createOrganization(org: Partial<Organization>): Promise<Organization> {
    const [organization] = await this.knex(this.organizationsTable)
      .insert({
        ...org,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    return organization;
  }

  async findOrganization(id: string): Promise<Organization | null> {
    const organization = await this.knex(this.organizationsTable)
      .where('id', id)
      .first();
    return organization || null;
  }

  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization> {
    const [organization] = await this.knex(this.organizationsTable)
      .where('id', id)
      .update({
        ...updates,
        updated_at: new Date(),
      })
      .returning('*');
    return organization;
  }

  async deleteOrganization(id: string): Promise<void> {
    await this.knex(this.organizationsTable)
      .where('id', id)
      .delete();
  }

  async getUserOrganizations(entityId: string): Promise<Array<Organization & { role: string; permissions: string[] }>> {
    const query = this.knex(this.organizationsTable)
      .select([
        `${this.organizationsTable}.*`,
        `${this.membersTable}.role`,
        `${this.membersTable}.permissions`,
      ])
      .innerJoin(
        this.membersTable,
        `${this.organizationsTable}.id`,
        `${this.membersTable}.organization_id`
      )
      .where(`${this.membersTable}.entity_id`, entityId);

    const results = await query;
    
    return results.map(row => ({
      ...row,
      permissions: Array.isArray(row.permissions) ? row.permissions : (row.permissions ? JSON.parse(row.permissions) : []),
    }));
  }

  // Member management
  async addMember(member: Partial<OrganizationMember>): Promise<OrganizationMember> {
    const [newMember] = await this.knex(this.membersTable)
      .insert({
        ...member,
        permissions: JSON.stringify(member.permissions || []),
        teams: JSON.stringify(member.teams || []),
        joined_at: new Date(),
      })
      .returning('*');
    
    return {
      ...newMember,
      permissions: Array.isArray(newMember.permissions) 
        ? newMember.permissions 
        : JSON.parse(newMember.permissions || '[]'),
      teams: Array.isArray(newMember.teams) 
        ? newMember.teams 
        : JSON.parse(newMember.teams || '[]'),
    };
  }

  async findMember(organizationId: string, entityId: string): Promise<OrganizationMember | null> {
    const member = await this.knex(this.membersTable)
      .where('organization_id', organizationId)
      .where('entity_id', entityId)
      .first();

    if (!member) return null;

    return {
      ...member,
      permissions: Array.isArray(member.permissions) 
        ? member.permissions 
        : JSON.parse(member.permissions || '[]'),
      teams: Array.isArray(member.teams) 
        ? member.teams 
        : JSON.parse(member.teams || '[]'),
    };
  }

  async updateMember(
    organizationId: string, 
    entityId: string, 
    updates: Partial<OrganizationMember>
  ): Promise<OrganizationMember> {
    const updateData: any = { ...updates };
    
    if (updates.permissions) {
      updateData.permissions = JSON.stringify(updates.permissions);
    }
    if (updates.teams) {
      updateData.teams = JSON.stringify(updates.teams);
    }

    const [member] = await this.knex(this.membersTable)
      .where('organization_id', organizationId)
      .where('entity_id', entityId)
      .update(updateData)
      .returning('*');

    return {
      ...member,
      permissions: Array.isArray(member.permissions) 
        ? member.permissions 
        : JSON.parse(member.permissions || '[]'),
      teams: Array.isArray(member.teams) 
        ? member.teams 
        : JSON.parse(member.teams || '[]'),
    };
  }

  async removeMember(organizationId: string, entityId: string): Promise<void> {
    await this.knex(this.membersTable)
      .where('organization_id', organizationId)
      .where('entity_id', entityId)
      .delete();
  }

  async getOrganizationMembers(organizationId: string, role?: string): Promise<OrganizationMember[]> {
    let query = this.knex(this.membersTable)
      .where('organization_id', organizationId);

    if (role) {
      query = query.where('role', role);
    }

    const members = await query;

    return members.map(member => ({
      ...member,
      permissions: Array.isArray(member.permissions) 
        ? member.permissions 
        : JSON.parse(member.permissions || '[]'),
      teams: Array.isArray(member.teams) 
        ? member.teams 
        : JSON.parse(member.teams || '[]'),
    }));
  }

  // Legacy support for admin plugin compatibility
  async findEntity(id: string, field: string): Promise<OrgUser | null> {
    // Map legacy calls to new member lookup
    if (field === 'entity_id') {
      // Find any membership for this entity (return first one found)
      const member = await this.knex(this.membersTable)
        .where('entity_id', id)
        .first();
      
      if (!member) return null;

      return {
        ...member,
        permissions: Array.isArray(member.permissions) 
          ? member.permissions 
          : JSON.parse(member.permissions || '[]'),
        teams: Array.isArray(member.teams) 
          ? member.teams 
          : JSON.parse(member.teams || '[]'),
      };
    }

    // Default case - lookup by id
    const member = await this.knex(this.membersTable)
      .where(field, id)
      .first();

    if (!member) return null;

    return {
      ...member,
      permissions: Array.isArray(member.permissions) 
        ? member.permissions 
        : JSON.parse(member.permissions || '[]'),
      teams: Array.isArray(member.teams) 
        ? member.teams 
        : JSON.parse(member.teams || '[]'),
    };
  }

  async createEntity(entity: Partial<OrgUser>): Promise<OrgUser> {
    // Map legacy calls to new member creation
    const [member] = await this.knex(this.membersTable)
      .insert({
        ...entity,
        permissions: JSON.stringify(entity.permissions || []),
        teams: JSON.stringify(entity.teams || []),
        joined_at: new Date(),
      })
      .returning('*');

    return {
      ...member,
      permissions: Array.isArray(member.permissions) 
        ? member.permissions 
        : JSON.parse(member.permissions || '[]'),
      teams: Array.isArray(member.teams) 
        ? member.teams 
        : JSON.parse(member.teams || '[]'),
    };
  }

  async updateEntity(id: string, field: string, entity: Partial<OrgUser>): Promise<OrgUser> {
    const updateData: any = { ...entity };
    
    if (entity.permissions) {
      updateData.permissions = JSON.stringify(entity.permissions);
    }
    if (entity.teams) {
      updateData.teams = JSON.stringify(entity.teams);
    }

    const [member] = await this.knex(this.membersTable)
      .where(field, id)
      .update(updateData)
      .returning('*');

    return {
      ...member,
      permissions: Array.isArray(member.permissions) 
        ? member.permissions 
        : JSON.parse(member.permissions || '[]'),
      teams: Array.isArray(member.teams) 
        ? member.teams 
        : JSON.parse(member.teams || '[]'),
    };
  }

  async deleteEntity(id: string, field: string): Promise<void> {
    await this.knex(this.membersTable)
      .where(field, id)
      .delete();
  }
} 