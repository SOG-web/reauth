import { asValue, AwilixContainer } from 'awilix';
import { AuthOutput, AuthPlugin, AuthStep, ReAuthCradle } from '../../types';
import { checkDependsOn, createAuthPlugin } from '../utils';
import { extractEntityId } from '../admin/ban-interceptor';

interface OrgConfig {
  orgService: OrgService;
}

export const organizationPluginDependsOn = ['admin'];

const plugin: AuthPlugin<OrgConfig> = {
  config: {},
  name: 'organization',
  steps: [],
  dependsOn: organizationPluginDependsOn,
  async initialize(container: AwilixContainer<ReAuthCradle>) {
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

    container.cradle.reAuthEngine.registerSessionHook(
      'after',
      async (data, container) => {
        const { token, ...rest } = data as AuthOutput;
        // Pass token along so the helper has full context
        const entityId = await extractEntityId({ token, ...rest }, container);

        if (!entityId) {
          throw new Error(
            'something is wrong with the session generation process, this is not suppose to happen',
          );
        }

        //TODO: this still full blown proper checking
        //FIX: Do not use this plugin for now
        const org = await container.cradle.orgService.findEntity(
          entityId,
          'entity_id',
        );

        if (!org) {
          throw new Error('entity not found');
        }

        return data;
      },
    );

    throw new Error('organization plugin is not ready for production');
  },
  migrationConfig: {
    pluginName: 'organization',
    tables: [
      {
        tableName: 'org',
        columns: {
          id: {
            type: 'uuid',
            primary: true,
            nullable: false,
            unique: true,
            defaultValue: 'uuid',
          },
          entity_id: {
            type: 'uuid',
            nullable: false,
            unique: true,
            index: true,
          },
          permissions: {
            type: 'string',
            nullable: false,
          },
          roles: {
            type: 'string',
            nullable: false,
          },
          teams: {
            type: 'string',
            nullable: true,
          },
        },
      },
    ],
  },
};

export default function organizationPlugin(
  config: OrgConfig,
  overrideStep?: {
    name: string;
    override: Partial<AuthStep<OrgConfig>>;
  }[],
): AuthPlugin<OrgConfig> {
  return createAuthPlugin(config, plugin, overrideStep, {});
}

//TODO: check the role in email-password plugin

declare module '../../types' {
  interface EntityExtension {
    /**
     * this is a computed value
     */
    teams?: string[] | null;
  }

  interface ReAuthCradleExtension {
    orgService: OrgService;
  }
}

export type OrgUser = {
  id: string;
  entity_id: string;
  permissions?: string[];
  roles?: string[];
};

export type OrgService = {
  findEntity(id: string, filed: string): Promise<OrgUser | null>;
  createEntity(entity: Partial<OrgUser>): Promise<OrgUser>;
  updateEntity(
    id: string,
    filed: string,
    entity: Partial<OrgUser>,
  ): Promise<OrgUser>;
  deleteEntity(id: string, filed: string): Promise<void>;
};
