import { Knex } from 'knex';
import { createReAuthEngine } from '../../auth-engine';
import emailPasswordAuth from "../email-password/email-password.plugin"
import adminPlugin from '../admin/admin.plugin';
import organizationPlugin from './org.plugin';
import { KnexOrgService } from './knex-org-service';
import { KnexEntityService, KnexSessionService } from '../../services';

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

// Example: Organization workflow
export async function exampleOrganizationWorkflow() {
  // This would typically be done in your database setup
  const knex = require('knex')({
    client: 'sqlite3',
    connection: ':memory:',
    useNullAsDefault: true,
  });

  // Create tables (in real app, use migrations)
  await setupTables(knex);

  const reAuth = createAuthWithOrganizationPlugin(knex);

  try {
    // 1. Register a user
    const registerResult = await reAuth.executeStep('email-password', 'register', {
      email: 'owner@example.com',
      password: 'SecurePassword123!',
    });

    if (!registerResult.success) {
      throw new Error('Registration failed');
    }

    const { entity, token } = registerResult;

    // 2. Create an organization
    const createOrgResult = await reAuth.executeStep('organization', 'create-organization', {
      name: 'Acme Corp',
      description: 'A great company',
      entity,
      token,
    });

    console.log('Organization created:', createOrgResult.organization);

    // 3. Register another user
    const memberRegisterResult = await reAuth.executeStep('email-password', 'register', {
      email: 'member@example.com',
      password: 'SecurePassword123!',
    });

    const memberEntity = memberRegisterResult.entity;

    // 4. Add member to organization
    const joinOrgResult = await reAuth.executeStep('organization', 'join-organization', {
      organization_id: createOrgResult.organization.id,
      role: 'developer',
      permissions: ['read', 'write'],
      entity: memberEntity,
      token: memberRegisterResult.token,
    });

    console.log('Member joined organization:', joinOrgResult.member);

    // 5. Get user's organizations
    const getUserOrgsResult = await reAuth.executeStep('organization', 'get-organizations', {
      entity: memberEntity,
      token: memberRegisterResult.token,
    });

    console.log('User organizations:', getUserOrgsResult.organizations);

    // 6. The session hook will automatically enhance the entity with organization data
    const sessionResult = await reAuth.checkSession(memberRegisterResult.token as string);
    console.log('Enhanced entity with org data:', sessionResult.entity);

  } catch (error) {
    console.error('Workflow error:', error);
  } finally {
    await knex.destroy();
  }
}

// Database setup helper
async function setupTables(knex: Knex) {
  // Entities table
  await knex.schema.createTable('entities', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('email').unique().notNullable();
    table.string('password_hash').notNullable();
    table.boolean('email_verified').defaultTo(false);
    table.string('role').defaultTo('user');
    table.timestamps(true, true);
  });

  // Sessions table
  await knex.schema.createTable('sessions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.uuid('entity_id').references('id').inTable('entities').onDelete('CASCADE');
    table.string('token').unique().notNullable();
    table.timestamp('expires_at').notNullable();
    table.timestamps(true, true);
  });

  // Admin entities table
  await knex.schema.createTable('admin_entities', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.uuid('entity_id').references('id').inTable('entities').onDelete('CASCADE');
    table.json('permissions');
    table.json('roles');
    table.timestamps(true, true);
  });

  // Organizations table
  await knex.schema.createTable('organizations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('name').notNullable();
    table.text('description');
    table.uuid('owner_id').references('id').inTable('entities').onDelete('CASCADE');
    table.timestamps(true, true);
    table.index(['owner_id']);
    table.index(['name']);
  });

  // Organization members table
  await knex.schema.createTable('organization_members', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.uuid('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.uuid('entity_id').references('id').inTable('entities').onDelete('CASCADE');
    table.string('role', 50).defaultTo('member');
    table.json('permissions');
    table.json('teams');
    table.timestamp('joined_at').defaultTo(knex.fn.now());
    table.unique(['organization_id', 'entity_id']);
    table.index(['entity_id']);
    table.index(['role']);
  });
}

// Express.js API routes example
export function createExpressOrganizationRoutes(reAuth: any) {
  const express = require('express');
  const router = express.Router();

  // Middleware to extract user from session
  router.use(async (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const session = await reAuth.checkSession(token);
      if (session.valid) {
        req.user = session.entity;
        req.token = session.token;
      }
    }
    next();
  });

  // Create organization
  router.post('/organizations', async (req: any, res: any) => {
    try {
      const result = await reAuth.executeStep('organization', 'create-organization', {
        ...req.body,
        entity: req.user,
        token: req.token,
      });
      
      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Join organization
  router.post('/organizations/:id/join', async (req: any, res: any) => {
    try {
      const result = await reAuth.executeStep('organization', 'join-organization', {
        organization_id: req.params.id,
        ...req.body,
        entity: req.user,
        token: req.token,
      });
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(result.status === 'not_found' ? 404 : 400).json(result);
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get user's organizations
  router.get('/organizations', async (req: any, res: any) => {
    try {
      const result = await reAuth.executeStep('organization', 'get-organizations', {
        entity: req.user,
        token: req.token,
      });
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

// React hook example
export const useOrganizations = () => {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);

  const createOrganization = async (data: { name: string; description: string }) => {
    setLoading(true);
    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      if (result.success) {
        await fetchOrganizations(); // Refresh list
        return result.organization;
      } else {
        throw new Error(result.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const joinOrganization = async (organizationId: string, role = 'member') => {
    setLoading(true);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ role }),
      });
      
      const result = await response.json();
      if (result.success) {
        await fetchOrganizations(); // Refresh list
        return result.member;
      } else {
        throw new Error(result.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/organizations', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      const result = await response.json();
      if (result.success) {
        setOrganizations(result.organizations);
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    organizations,
    loading,
    createOrganization,
    joinOrganization,
    fetchOrganizations,
  };
};

function useState(arg0: any): [any, any] {
  throw new Error('Function not implemented.');
} 