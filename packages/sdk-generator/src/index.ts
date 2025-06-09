#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { jsonSchemaToZod } from 'json-schema-to-zod';
import prettier from 'prettier';
import { program } from 'commander';
import axios from 'axios';

program
  .version('0.0.1')
  .description(
    'A CLI to generate a ReAuth TypeScript SDK from an introspection endpoint.',
  )
  .requiredOption('-u, --url <url>', 'URL of the introspection endpoint.')
  .requiredOption(
    '-o, --output <path>',
    'Output directory for the generated SDK.',
  )
  .action(generate)
  .parse(process.argv);

async function generate(options: { url: string; output: string }) {
  try {
    console.log('🚀 Fetching introspection data from:', options.url);
    const response = await axios.get(options.url);
    const introspectionData = response.data.data;

    const { entity, plugins } = introspectionData;
    const outputDir = options.output;
    const pluginsDir = path.join(outputDir, 'plugins');

    // Create directories
    await fs.mkdir(pluginsDir, { recursive: true });

    // Generate entity schema file
    let entitySchemaCode = `import { z } from 'zod';\n\n`;
    entitySchemaCode += `export ${jsonSchemaToZod(entity, { name: 'entitySchema' })}\n`;
    const formattedEntitySchema = await prettier.format(entitySchemaCode, {
      parser: 'typescript',
      semi: true,
      singleQuote: true,
      trailingComma: 'all',
    });
    await fs.writeFile(
      path.join(outputDir, 'schemas.ts'),
      formattedEntitySchema,
    );

    const pluginFileNames: string[] = [];

    // Generate a file for each plugin
    for (const plugin of plugins) {
      const pluginName = plugin.name.replace(/-/g, '_');
      const fileName = `${plugin.name}.ts`;
      pluginFileNames.push(fileName);

      let pluginCode = `
                import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
                import { z } from 'zod';
            \n\n`;

      const stepMethods: string[] = [];

      for (const step of plugin.steps) {
        const stepName = step.name.replace(/-/g, '_');
        const inputSchemaName = `${pluginName}_${stepName}_inputSchema`;
        const outputSchemaName = `${pluginName}_${stepName}_outputSchema`;

        pluginCode += `export ${jsonSchemaToZod(step.inputs, { name: inputSchemaName })}\n`;
        pluginCode += `export ${jsonSchemaToZod(step.outputs, { name: outputSchemaName })}\n\n`;

        const apiPostLogic = step.requiresAuth
          ? `
                            const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
                            if (callbacks?.interceptors?.request) {
                                callbacks.interceptors.request(requestConfig);
                            }
                            const token = getToken();
                            if (token) {
                                requestConfig.headers = { ...requestConfig.headers, Authorization: \`Bearer \${token}\` };
                            }
                            const response = await api.post('/auth/${plugin.name}/${step.name}', payload, requestConfig);`
          : `const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
                             if (callbacks?.interceptors?.request) {
                                callbacks.interceptors.request(requestConfig);
                             }
                             const response = await api.post('/auth/${plugin.name}/${step.name}', payload, requestConfig);`;

        stepMethods.push(`
                    ${stepName}: async (
                        payload: z.infer<typeof ${inputSchemaName}>,
                        callbacks?: {
                            onRequest?: () => void;
                            onSuccess?: (data: z.infer<typeof ${outputSchemaName}>) => void;
                            onError?: (error: any) => void;
                            interceptors?: {
                                request?: (config: AxiosRequestConfig) => any;
                                response?: (response: AxiosResponse) => any;
                            }
                        }
                    ) => {
                        callbacks?.onRequest?.();
                        try {
                            ${inputSchemaName}.parse(payload);
                            ${apiPostLogic}
                            let processedResponse = response;
                            if (callbacks?.interceptors?.response) {
                                processedResponse = callbacks.interceptors.response(response);
                            }
                            const data = ${outputSchemaName}.parse(processedResponse.data.data);
                            callbacks?.onSuccess?.(data);
                            return { data, error: null };
                        } catch (error) {
                            callbacks?.onError?.(error);
                            return { data: null, error };
                        }
                    }
                `);
      }

      pluginCode += `
                export const create${pluginName.charAt(0).toUpperCase() + pluginName.slice(1)}Endpoints = (api: AxiosInstance, getToken: () => string | null, config: any) => ({
                    ${stepMethods.join(',\n')}
                });
            `;

      const formattedPluginCode = await prettier.format(pluginCode, {
        parser: 'typescript',
        semi: true,
        singleQuote: true,
        trailingComma: 'all',
      });
      await fs.writeFile(path.join(pluginsDir, fileName), formattedPluginCode);
    }

    // Generate main index.ts
    let indexCode = `
            import axios from 'axios';
            import type { AxiosInstance, AxiosRequestConfig } from 'axios';
        `;

    for (const fileName of pluginFileNames) {
      const pluginName = fileName.replace('.ts', '').replace(/-/g, '_');
      const functionName = `create${pluginName.charAt(0).toUpperCase() + pluginName.slice(1)}Endpoints`;
      indexCode += `import { ${functionName} } from './plugins/${fileName.replace('.ts', '')}';\n`;
    }

    indexCode += `
            interface AuthClientConfig {
              baseURL?: string;
              axiosInstance?: AxiosInstance;
              axiosConfig?: AxiosRequestConfig;
              auth?: {
                type: 'localstorage' | 'sessionstorage' | 'cookie' | 'custom';
                key?: string;
                getToken?: () => string | null;
              }
            }

            export const createReAuthClient = (config: AuthClientConfig) => {
                if (!config.axiosInstance && !config.baseURL) {
                    throw new Error('Either baseURL or a pre-configured axiosInstance must be provided.');
                }

                const api = config.axiosInstance || axios.create({
                    ...config.axiosConfig,
                    baseURL: config.baseURL,
                    withCredentials: config.auth?.type === 'cookie',
                });

                const getToken = (): string | null => {
                    if (!config.auth || typeof window === 'undefined' || config.auth.type === 'cookie') return null;
                    const { type, key, getToken: customGetToken } = config.auth;
                    switch (type) {
                        case 'localstorage': return localStorage.getItem(key || 'reauth-token');
                        case 'sessionstorage': return sessionStorage.getItem(key || 'reauth-token');
                        case 'custom': return customGetToken ? customGetToken() : null;
                        default: return null;
                    }
                };

                const client = {
        `;

    for (const fileName of pluginFileNames) {
      const pluginName = fileName.replace('.ts', '').replace(/-/g, '_');
      const functionName = `create${pluginName.charAt(0).toUpperCase() + pluginName.slice(1)}Endpoints`;
      indexCode += `  ${pluginName}: ${functionName}(api, getToken, config),\n`;
    }

    indexCode += `
                };

                return {
                    ...client,
                    axiosInstance: api,
                    interceptors: api.interceptors,
                }
            };
        `;

    const formattedIndexCode = await prettier.format(indexCode, {
      parser: 'typescript',
      semi: true,
      singleQuote: true,
      trailingComma: 'all',
    });
    await fs.writeFile(path.join(outputDir, 'index.ts'), formattedIndexCode);

    console.log('✅ SDK generated successfully!');
    console.log(`✅ Output directory: ${outputDir}`);
  } catch (error) {
    console.error('Error generating SDK:', error);
    process.exit(1);
  }
}
