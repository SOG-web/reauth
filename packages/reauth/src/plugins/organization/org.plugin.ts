import { asValue, AwilixContainer } from 'awilix';
import { AuthOutput, AuthPlugin, AuthStep, ReAuthCradle, AuthInput, RootStepHooks } from '../../types';
import { checkDependsOn, createAuthPlugin } from '../utils';
import { type } from 'arktype';

interface OrgConfig {
  orgService: OrgService;
  /**
   * Default role for new organization members (default: 'member')
   */
  defaultRole?: string;
  /**
   * Default permissions for new organization members
   */
  defaultPermissions?: string[];
  /**
   * Maximum number of organizations a user can create (default: unlimited)
   */
  maxOrganizations?: number;
  /**
   * Whether users can create organizations (default: true)
   */
  allowOrgCreation?: boolean;

  /**
   * Root hooks
   * @example
   * rootHooks: {
   *  before: async (input, pluginProperties) => {
   *    // do something before the plugin runs
   *  }
   */
  rootHooks?: RootStepHooks;
}

export const organizationPluginDependsOn = ['admin'];

// ArkType schemas for validation
const createOrganizationSchema = type({
  name: 'string>=1',
  'description?': 'string',
});

const joinOrganizationSchema = type({
  organizationId: 'string>=1',
  'role?': 'string',
  'permissions?': 'string[]',
});

const getOrganizationsSchema = type({});

const plugin: AuthPlugin<OrgConfig> = {
  config: {},
  name: 'organizationPlugin',
  steps: [
    {
      name: 'create-organization',
      description: 'Create a new organization',
      validationSchema: createOrganizationSchema,
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
        "organization?": 'object',
      }),
      async run(input: AuthInput, pluginProperties): Promise<AuthOutput> {
        const { container, config } = pluginProperties!;
        const { name, description, entity } = input;

        if (!entity) {
          return {
            success: false,
            message: 'Authentication required',
            status: 'unauthorized',
          };
        }

        // Check if user can create organizations
        if (config.allowOrgCreation === false) {
          return {
            success: false,
            message: 'Organization creation not allowed',
            status: 'forbidden',
          };
        }

        try {
          const organization = await container.cradle.orgService.createOrganization({
            name,
            description,
            owner_id: entity.id,
          });

          // Add creator as owner member
          await container.cradle.orgService.addMember({
            organization_id: organization.id,
            entity_id: entity.id,
            role: 'owner',
            permissions: ['*'], // Owner has all permissions
          });

          return {
            success: true,
            message: 'Organization created successfully',
            organization,
            status: 'created',
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to create organization: ${error.message}`,
            status: 'error',
          };
        }
      },
      hooks: {},
      inputs: ['entity', 'name', 'description'],
      protocol: {
        http: {
          method: 'POST',
          auth: true,
          lim: 429,
          su: 201,
        },
      },
    },
    {
      name: 'join-organization',
      description: 'Join an organization',
      validationSchema: joinOrganizationSchema,
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
        "membership?": 'object',
      }),
      async run(input: AuthInput, pluginProperties): Promise<AuthOutput> {
        const { container, config } = pluginProperties!;
        const { organizationId, role, permissions, entity } = input;

        if (!entity) {
          return {
            success: false,
            message: 'Authentication required',
            status: 'unauthorized',
          };
        }

        try {
          // Check if organization exists
          const organization = await container.cradle.orgService.findOrganization(organizationId);
          if (!organization) {
            return {
              success: false,
              message: 'Organization not found',
              status: 'not_found',
            };
          }

          // Check if user is already a member
          const existingMember = await container.cradle.orgService.findMember(organizationId, entity.id);
          if (existingMember) {
            return {
              success: false,
              message: 'Already a member of this organization',
              status: 'conflict',
            };
          }

          const memberRole = role || config.defaultRole || 'member';
          const memberPermissions = permissions || config.defaultPermissions || [];

          const member = await container.cradle.orgService.addMember({
            organization_id: organizationId,
            entity_id: entity.id,
            role: memberRole,
            permissions: memberPermissions,
          });

          return {
            success: true,
            message: 'Successfully joined organization',
            member,
            organization,
            status: 'success',
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to join organization: ${error.message}`,
            status: 'error',
          };
        }
      },
      hooks: {},
      inputs: ['entity', 'organizationId', 'role', 'permissions'],
      protocol: {
        http: {
          method: 'POST',
          auth: true,
          success: 200,
          error: 400,
          not_found: 404,
          conflict: 409,
          unauthorized: 401,
        },
      },
    },
    {
      name: 'get-organizations',
      description: 'Get user organizations',
      validationSchema: getOrganizationsSchema,
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
        "organizations?": 'object[]',
      }),
      async run(input: AuthInput, pluginProperties): Promise<AuthOutput> {
        const { container } = pluginProperties!;
        const { entity } = input;

        if (!entity) {
          return {
            success: false,
            message: 'Authentication required',
            status: 'unauthorized',
          };
        }

        try {
          const organizations = await container.cradle.orgService.getUserOrganizations(entity.id);

          return {
            success: true,
            message: 'Organizations retrieved successfully',
            organizations,
            status: 'success',
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to get organizations: ${error.message}`,
            status: 'error',
          };
        }
      },
      hooks: {},
      inputs: ['entity'],
      protocol: {
        http: {
          method: 'GET',
          auth: true,
          success: 200,
          error: 400,
          unauthorized: 401,
        },
      },
    },
  ],
  dependsOn: organizationPluginDependsOn,
  async initialize(container: AwilixContainer<ReAuthCradle>) {
    // TODO: Organization plugin is not yet complete. Missing features:
    // - Complete testing and validation
    // - Error handling improvements  
    // - Performance optimizations
    // - Additional security measures
    // - Integration with other plugins
    // - Documentation updates
    // - Role-based access control refinements
    // - Audit logging capabilities
    throw new Error('Organization plugin is not yet ready for production use. This is a work in progress.');

    // This code will be enabled when the plugin is ready:
    /*
    if (!this.config.orgService) {
      throw new Error('orgService is missing');
    }

    const dpn = checkDependsOn(
      container.cradle.reAuthEngine.getAllPlugins(),
      this.dependsOn!,
    );

    if (!dpn.status)
      throw new Error(
        `${this.name} depends on the following plugins ${dpn.pluginName.join(' ')}`,
      );

    container.register({
      orgService: asValue(this.config.orgService),
    });
    */

    // Register session hook to enhance entity with organization data
    // container.cradle.reAuthEngine.registerSessionHook(
    //   'after',
    //   async (data, container) => {
    //     const { entity, ...rest } = data as AuthOutput;

    //     if (!entity) {
    //       return data;
    //     }

    //     try {
    //       // Get user's organizations
    //       const organizations = await container.cradle.orgService.getUserOrganizations(entity.id);
          
    //       // Extract teams from all organizations
    //       const teams: string[] = [];
    //       for (const org of organizations) {
    //         const member = await container.cradle.orgService.findMember(org.id, entity.id);
    //         if (member && member.teams) {
    //           teams.push(...member.teams);
    //         }
    //       }

    //       // Add organization data to entity
    //       const enhancedEntity = {
    //         ...entity,
    //         organizations: organizations.map(org => ({
    //           id: org.id,
    //           name: org.name,
    //           role: org.role,
    //           permissions: org.permissions,
    //         })),
    //         teams: teams.length > 0 ? teams : null,
    //       };

    //       return {
    //         ...rest,
    //         entity: enhancedEntity,
    //       };
    //     } catch (error) {
    //       console.warn('Failed to enhance entity with organization data:', error);
    //       return data;
    //     }
    //   },
    // );
  },
  migrationConfig: {
    pluginName: 'organization',
    tables: [
      {
        tableName: 'organizations',
        columns: {
          id: {
            type: 'uuid',
            primary: true,
            nullable: false,
            unique: true,
            defaultValue: 'uuid',
          },
          name: {
            type: 'string',
            nullable: false,
            length: 255,
          },
          description: {
            type: 'text',
            nullable: true,
          },
          owner_id: {
            type: 'uuid',
            nullable: false,
            references: {
              table: 'entities',
              column: 'id',
              onDelete: 'CASCADE',
            },
          },
          created_at: {
            type: 'timestamp',
            nullable: false,
            defaultValue: 'now()',
          },
          updated_at: {
            type: 'timestamp',
            nullable: false,
            defaultValue: 'now()',
          },
        },
      },
      {
        tableName: 'organization_members',
        columns: {
          id: {
            type: 'uuid',
            primary: true,
            nullable: false,
            unique: true,
            defaultValue: 'uuid',
          },
          organization_id: {
            type: 'uuid',
            nullable: false,
            references: {
              table: 'organizations',
              column: 'id',
              onDelete: 'CASCADE',
            },
          },
          entity_id: {
            type: 'uuid',
            nullable: false,
            references: {
              table: 'entities',
              column: 'id',
              onDelete: 'CASCADE',
            },
          },
          role: {
            type: 'string',
            nullable: false,
            length: 50,
            defaultValue: 'member',
          },
          permissions: {
            type: 'json',
            nullable: true,
          },
          teams: {
            type: 'json',
            nullable: true,
          },
          joined_at: {
            type: 'timestamp',
            nullable: false,
            defaultValue: 'now()',
          },
        },
      },
    ],
  },
  getSensitiveFields() {
    return ['permissions'];
  },
};

export default function organizationPlugin(
  config: OrgConfig,
  overrideStep?: {
    name: string;
    override: Partial<AuthStep<OrgConfig>>;
  }[],
): AuthPlugin<OrgConfig> {
  return createAuthPlugin(config, plugin, overrideStep, {
    defaultRole: 'member',
    defaultPermissions: [],
    allowOrgCreation: true,
  });
}

declare module '../../types' {
  interface EntityExtension {
    /**
     * Organizations this user belongs to
     */
    organizations?: Array<{
      id: string;
      name: string;
      role: string;
      permissions: string[];
    }> | null;
    /**
     * Teams this user belongs to across all organizations
     */
    teams?: string[] | null;
  }

  interface ReAuthCradleExtension {
    orgService: OrgService;
  }
}

export interface Organization {
  id: string;
  name: string;
  description?: string | null;
  owner_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  entity_id: string;
  role: string;
  permissions?: string[];
  teams?: string[];
  joined_at: Date;
}

export type OrgUser = OrganizationMember; // Backward compatibility

export type OrgService = {
  // Organization management
  createOrganization(org: Partial<Organization>): Promise<Organization>;
  findOrganization(id: string): Promise<Organization | null>;
  updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization>;
  deleteOrganization(id: string): Promise<void>;
  getUserOrganizations(entityId: string): Promise<Array<Organization & { role: string; permissions: string[] }>>;

  // Member management
  addMember(member: Partial<OrganizationMember>): Promise<OrganizationMember>;
  findMember(organizationId: string, entityId: string): Promise<OrganizationMember | null>;
  updateMember(organizationId: string, entityId: string, updates: Partial<OrganizationMember>): Promise<OrganizationMember>;
  removeMember(organizationId: string, entityId: string): Promise<void>;
  getOrganizationMembers(organizationId: string, role?: string): Promise<OrganizationMember[]>;

  // Legacy support for admin plugin compatibility
  findEntity(id: string, field: string): Promise<OrgUser | null>;
  createEntity(entity: Partial<OrgUser>): Promise<OrgUser>;
  updateEntity(id: string, field: string, entity: Partial<OrgUser>): Promise<OrgUser>;
  deleteEntity(id: string, field: string): Promise<void>;
};
