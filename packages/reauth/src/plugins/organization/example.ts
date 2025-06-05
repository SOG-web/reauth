import { Knex } from 'knex';
import { createReAuthEngine } from '../../auth-engine';
import emailPasswordAuth from '../email-password/email-password.plugin';
import adminPlugin from '../admin/admin.plugin';
import organizationPlugin from './org.plugin';
import { KnexOrgService } from './knex-org-service';
import { KnexEntityService, KnexSessionService } from '../../services';
import { Entity } from '../../types';

// Example: Using the organization plugin with other plugins
export function createAuthWithOrganizationPlugin(knex: Knex) {
  const entityService = new KnexEntityService(knex, 'entities');
  const sessionService = new KnexSessionService(knex, 'sessions');
  const orgService = new KnexOrgService(knex, 'organizations', 'organization_members');

  // Create a mock admin entity service for the admin plugin
  const adminEntityService = {
    findEntity: async (id: string, field: string) => {
      const result = await knex('admin_entities').where(field, id).first();
      return result || null;
    },
    createEntity: async (entity: any) => {
      const [result] = await knex('admin_entities').insert(entity).returning('*');
      return result;
    },
    updateEntity: async (id: string, field: string, entity: any) => {
      const [result] = await knex('admin_entities')
        .where(field, id)
        .update(entity)
        .returning('*');
      return result;
    },
    deleteEntity: async (id: string, field: string) => {
      await knex('admin_entities').where(field, id).delete();
    },
  };

  const reAuth = createReAuthEngine({
    plugins: [
      emailPasswordAuth({
        verifyEmail: false,
        sendCode: async (entity, code, email, type) => {
          console.log(`Send ${type} code ${code} to ${email}`);
        },
      }),
      adminPlugin({
        adminEntity: adminEntityService,
      }),
      organizationPlugin({
        orgService,
        defaultRole: 'member',
        defaultPermissions: ['read'],
        allowOrgCreation: true,
        maxOrganizations: 5,
      }),
    ],
    entity: entityService,
    session: sessionService,
  });

  return reAuth;
}

// Example workflow
export async function organizationWorkflowExample() {
  console.log('Example organization workflow:');
  
  // This would be your database instance
  const knex = {} as Knex; // Replace with actual knex instance
  
  const reAuth = createAuthWithOrganizationPlugin(knex);

  // 1. Create an organization
  const createOrgResult = await reAuth.executeStep('organization', 'create-organization', {
    name: 'Acme Corp',
    description: 'A great company',
    entity: { id: 'user-1' } as Entity, // Authenticated user
    token: 'valid-token',
  });

  // 2. Join an organization
  const joinOrgResult = await reAuth.executeStep('organization', 'join-organization', {
    organization_id: 'org-123',
    role: 'developer',
    permissions: ['read', 'write'],
    entity: { id: 'user-2' } as Entity,
    token: 'valid-token',
  });

  // 3. Get user's organizations
  const getUserOrgsResult = await reAuth.executeStep('organization', 'get-organizations', {
    entity: { id: 'user-1' } as Entity,
    token: 'valid-token',
  });

  console.log('Organizations:', getUserOrgsResult.organizations);
} 