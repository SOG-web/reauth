#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { jsonSchemaToZod } from 'json-schema-to-zod';
import prettier from 'prettier';
import { program } from 'commander';
import axios from 'axios';

interface StepDefinition {
  name: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  requiresAuth: boolean;
}

interface PluginDefinition {
  name: string;
  steps: StepDefinition[];
}

interface HttpConfig {
  basePath: string;
  tokenConfig: {
    header: {
      accessTokenHeader: string;
      refreshTokenHeader: string;
      useBearer: boolean;
    };
    cookie: {
      accessTokenName: string;
      refreshTokenName: string;
      enabled: boolean;
    };
  };
}

type HttpClient = 'axios' | 'fetch';

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
  .requiredOption('-k, --key <key>', 'Key to use for the generated SDK.')
  .option('-c, --client <client>', 'HTTP client to use (axios|fetch)', 'fetch')
  .action(generate)
  .parse(process.argv);

async function generate(options: {
  url: string;
  output: string;
  key: string;
  client: HttpClient;
}) {
  try {
    // Validate client option
    if (!['axios', 'fetch'].includes(options.client)) {
      throw new Error(
        'Invalid client option. Must be either "axios" or "fetch".',
      );
    }

    console.log('🚀 Fetching introspection data from:', options.url);
    console.log('🔧 Using HTTP client:', options.client);

    const response = await axios.get(options.url, {
      headers: {
        'x-reauth-key': options.key,
      },
    });
    const introspectionData = response.data.data;

    const { plugins, httpConfig } = introspectionData as {
      plugins: PluginDefinition[];
      httpConfig: HttpConfig;
    };
    const outputDir = options.output;
    const pluginsDir = path.join(outputDir, 'plugins');
    const basePath = httpConfig?.basePath || '';
    const tokenConfig = httpConfig?.tokenConfig;

    // Create directories
    await fs.mkdir(pluginsDir, { recursive: true });

    const pluginFileNames: string[] = [];

    // Generate a file for each plugin
    for (const plugin of plugins) {
      const pluginName = plugin.name.replace(/-/g, '_');
      const fileName = `${plugin.name}.ts`;
      pluginFileNames.push(fileName);

      let pluginCode: string;

      if (options.client === 'axios') {
        pluginCode = generateAxiosPluginCode(
          plugin,
          pluginName,
          basePath,
          tokenConfig,
        );
      } else {
        pluginCode = generateFetchPluginCode(
          plugin,
          pluginName,
          basePath,
          tokenConfig,
        );
      }

      const formattedPluginCode = await prettier.format(pluginCode, {
        parser: 'typescript',
        semi: true,
        singleQuote: true,
        trailingComma: 'all',
      });
      await fs.writeFile(path.join(pluginsDir, fileName), formattedPluginCode);
    }

    // Generate main index.ts
    let indexCode: string;
    if (options.client === 'axios') {
      indexCode = generateAxiosIndexCode(pluginFileNames, httpConfig);
    } else {
      indexCode = generateFetchIndexCode(pluginFileNames, httpConfig);
    }

    const formattedIndexCode = await prettier.format(indexCode, {
      parser: 'typescript',
      semi: true,
      singleQuote: true,
      trailingComma: 'all',
    });
    await fs.writeFile(path.join(outputDir, 'index.ts'), formattedIndexCode);

    console.log('✅ SDK generated successfully!');
    console.log(`✅ Output directory: ${outputDir}`);
    console.log(`✅ HTTP client: ${options.client}`);
  } catch (error) {
    console.error('Error generating SDK:', error);
    process.exit(1);
  }
}

function generateAxiosPluginCode(
  plugin: PluginDefinition,
  pluginName: string,
  basePath: string,
  tokenConfig?: HttpConfig['tokenConfig'],
): string {
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

    const endpoint = `${basePath}/${plugin.name}/${step.name}`;
    const useBearer = tokenConfig?.header?.useBearer ?? true;
    const accessTokenHeader =
      tokenConfig?.header?.accessTokenHeader ?? 'Authorization';
    const refreshTokenHeader =
      tokenConfig?.header?.refreshTokenHeader ?? 'X-Refresh-Token';

    const apiPostLogic = step.requiresAuth
      ? `
				const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
				if (callbacks?.interceptors?.request) {
					callbacks.interceptors.request(requestConfig);
				}
				const rawToken = await getToken();
				if (rawToken && typeof rawToken === 'object') {
					const accessToken = rawToken.accessToken;
                    const refreshToken = rawToken.refreshToken;
					if (accessToken) {
						const authValue = ${useBearer ? '`Bearer ${accessToken}`' : 'accessToken'};
						requestConfig.headers = { ...requestConfig.headers, '${accessTokenHeader}': authValue };
					}
					if (refreshToken) {
						requestConfig.headers = { ...requestConfig.headers, '${refreshTokenHeader}': refreshToken };
					}
				} else if (rawToken && typeof rawToken === 'string') {
					const authValue = ${useBearer ? '`Bearer ${rawToken}`' : 'rawToken'};
					requestConfig.headers = { ...requestConfig.headers, 'Authorization': authValue };
                  }


				const response = await api.post('${endpoint}', payload, requestConfig);`
      : `const requestConfig: AxiosRequestConfig = { ...config.axiosConfig };
				if (callbacks?.interceptors?.request) {
					callbacks.interceptors.request(requestConfig);
				}
				const response = await api.post('${endpoint}', payload, requestConfig);`;

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
					const data = ${outputSchemaName}.parse(processedResponse.data);
					callbacks?.onSuccess?.(data);
					return { data, error: null };
				} catch (error: any) {
					callbacks?.onError?.(error.response?.data || error.message);
					return { data: null, error: error.response?.data || error.message };
				}
			}
		`);
  }

  pluginCode += `
		export const create${pluginName.charAt(0).toUpperCase() + pluginName.slice(1)}Endpoints = (api: AxiosInstance, getToken: () => Promise<string | { accessToken: string; refreshToken: string } | null>, config: any) => ({
			${stepMethods.join(',\n')}
		});
	`;

  return pluginCode;
}

function generateFetchPluginCode(
  plugin: PluginDefinition,
  pluginName: string,
  basePath: string,
  tokenConfig?: HttpConfig['tokenConfig'],
): string {
  let pluginCode = `
		import { z } from 'zod';
		import fetch from 'cross-fetch';
	\n\n`;

  const stepMethods: string[] = [];

  for (const step of plugin.steps) {
    const stepName = step.name.replace(/-/g, '_');
    const inputSchemaName = `${pluginName}_${stepName}_inputSchema`;
    const outputSchemaName = `${pluginName}_${stepName}_outputSchema`;

    pluginCode += `export ${jsonSchemaToZod(step.inputs, { name: inputSchemaName })}\n`;
    pluginCode += `export ${jsonSchemaToZod(step.outputs, { name: outputSchemaName })}\n\n`;

    const endpoint = `${basePath}/${plugin.name}/${step.name}`;
    const useBearer = tokenConfig?.header?.useBearer ?? true;
    const accessTokenHeader =
      tokenConfig?.header?.accessTokenHeader ?? 'Authorization';
    const refreshTokenHeader =
      tokenConfig?.header?.refreshTokenHeader ?? 'X-Refresh-Token';

    const apiPostLogic = step.requiresAuth
      ? `
				const rawToken = await getToken();
				const headers: Record<string, string> = {
					'Content-Type': 'application/json',
					...config.headers,
				};
				if (rawToken && typeof rawToken === 'object') {
					const accessToken = rawToken.accessToken;
                    const refreshToken = rawToken.refreshToken;
					if (accessToken) {
						const authValue = ${useBearer ? '`Bearer ${accessToken}`' : 'accessToken'};
						headers['${accessTokenHeader}'] = authValue;
					}
					if (refreshToken) {
						headers['${refreshTokenHeader}'] = refreshToken;
					}
				} else if (rawToken && typeof rawToken === 'string') {
					const authValue = ${useBearer ? '`Bearer ${rawToken}`' : 'rawToken'};
					headers['Authorization'] = authValue;
				}

				let request: RequestInit = {
					method: 'POST',
					headers,
					body: JSON.stringify(payload),
					credentials: config.auth?.type === 'cookie' ? 'include' : 'same-origin',
					...config.fetchConfig,
				};

				if (callbacks?.interceptors?.request) {
					request = await callbacks.interceptors.request(payload, request);
				}
				const response = await fetch(\`\${config.baseURL}${endpoint}\`,request);`
      : `
				const headers: Record<string, string> = {
					'Content-Type': 'application/json',
					...config.headers,
				};

				let request: RequestInit = {
					method: 'POST',
					headers,
					body: JSON.stringify(payload),
					credentials: config.auth?.type === 'cookie' ? 'include' : 'same-origin',
					...config.fetchConfig,
				};

				if (callbacks?.interceptors?.request) {
					request = await callbacks.interceptors.request(payload, request);
				}
				const response = await fetch(\`\${config.baseURL}${endpoint}\`, request);`;

    stepMethods.push(`
			${stepName}: async (
				payload: z.infer<typeof ${inputSchemaName}>,
				callbacks?: {
					onRequest?: () => Promise<void>;
					onSuccess?: (data: z.infer<typeof ${outputSchemaName}>) => Promise<void>;
					onError?: (error: any) => Promise<void>;
					interceptors?: {
						request?: (payload: z.infer<typeof ${inputSchemaName}>, request: RequestInit) => Promise<RequestInit>;
						response?: (response: Response) => Promise<Response>;
					}
				}
			) => {
				callbacks?.onRequest?.();
				try {
					${inputSchemaName}.parse(payload);
					${apiPostLogic}
					
					if (!response.ok) {
						const errorData = await response.json().catch(() => ({ message: response.statusText }));
						throw new Error(JSON.stringify(errorData));
					}

					let processedResponse = response;
					if (callbacks?.interceptors?.response) {
						processedResponse = await callbacks.interceptors.response(response);
					}
					if (responseInterceptor) {
						processedResponse = await responseInterceptor(processedResponse);
					}
					if (callbacks?.interceptors?.response) {
						processedResponse = await callbacks.interceptors.response(response);
					}
					const responseData = await processedResponse.json();
					const data = ${outputSchemaName}.parse(responseData.data);
					await callbacks?.onSuccess?.(data);
					return { data, error: null };
				} catch (error: any) {
					const errorData = error.message ? JSON.parse(error.message) : error;
					await callbacks?.onError?.(errorData);
					return { data: null, error: errorData };
				}
			}
		`);
  }

  pluginCode += `
		export const create${pluginName.charAt(0).toUpperCase() + pluginName.slice(1)}Endpoints = (config: any, getToken: () => Promise<string | { accessToken: string; refreshToken: string } | null>, responseInterceptor?: (response: Response) => Promise<Response>) => ({
			${stepMethods.join(',\n')}
		});
	`;

  return pluginCode;
}

function generateAxiosIndexCode(
  pluginFileNames: string[],
  httpConfig?: HttpConfig,
): string {
  const tokenConfig = httpConfig?.tokenConfig;
  let indexCode = `
		import axios from 'axios';
		import type { AxiosInstance, AxiosRequestConfig } from 'axios';

		// Export HTTP configuration from introspection
		export const httpConfig = ${JSON.stringify(httpConfig, null, 2)};
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
				getToken?: () => Promise<string | { accessToken: string; refreshToken: string } | null>;
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

			const getToken = async (): Promise<string | { accessToken: string; refreshToken: string } | null> => {
				if (!config.auth || typeof window === 'undefined' || config.auth.type === 'cookie') return null;
				const { type, key, getToken: customGetToken } = config.auth;
				if (customGetToken) {
					return await customGetToken();
				}
				switch (type) {
					case 'localstorage': {
						const token = localStorage.getItem(key || 'reauth-token');
						if (!token) return null;
						try {
							return JSON.parse(token);
						} catch {
							return token;
						}
					}
					case 'sessionstorage': {
						const token = sessionStorage.getItem(key || 'reauth-token');
						if (!token) return null;
						try {
							return JSON.parse(token);
						} catch {
							return token;
						}
					}
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

  return indexCode;
}

function generateFetchIndexCode(
  pluginFileNames: string[],
  httpConfig?: HttpConfig,
): string {
  const tokenConfig = httpConfig?.tokenConfig;
  let indexCode = `
		
	`;

  for (const fileName of pluginFileNames) {
    const pluginName = fileName.replace('.ts', '').replace(/-/g, '_');
    const functionName = `create${pluginName.charAt(0).toUpperCase() + pluginName.slice(1)}Endpoints`;
    indexCode += `import { ${functionName} } from './plugins/${fileName.replace('.ts', '')}';\n`;
  }

  indexCode += `
		// Export HTTP configuration from introspection
		export const httpConfig = ${JSON.stringify(httpConfig, null, 2)};

		interface AuthClientConfig {
			baseURL: string;
			headers?: Record<string, string>;
			fetchConfig?: RequestInit;
			auth?: {
				type: 'localstorage' | 'sessionstorage' | 'cookie' | 'custom';
				key?: string;
				getToken?: () => Promise<string | { accessToken: string; refreshToken: string } | null>;
			},
			responseInterceptor?: (response: Response) => Promise<Response>;
		}

		export const createReAuthClient = (config: AuthClientConfig) => {
			if (!config.baseURL) {
				throw new Error('baseURL must be provided when using fetch client.');
			}

			const getToken = async (): Promise<string | { accessToken: string; refreshToken: string } | null> => {
				if (!config.auth) return null;
				const { type, key, getToken: customGetToken } = config.auth;
				if (customGetToken) {
					return await customGetToken();
				}
				switch (type) {
					case 'localstorage': {
						const token = localStorage.getItem(key || 'reauth-token');
						if (!token) return null;
						try {
							return JSON.parse(token);
						} catch {
							return token;
						}
					}
					case 'sessionstorage': {
						const token = sessionStorage.getItem(key || 'reauth-token');
						if (!token) return null;
						try {
							return JSON.parse(token);
						} catch {
							return token;
						}
					}
					default: return null;
				}
			};

			const client = {
	`;

  for (const fileName of pluginFileNames) {
    const pluginName = fileName.replace('.ts', '').replace(/-/g, '_');
    const functionName = `create${pluginName.charAt(0).toUpperCase() + pluginName.slice(1)}Endpoints`;
    indexCode += `  ${pluginName}: ${functionName}(config, getToken, config.responseInterceptor),\n`;
  }

  indexCode += `
			};

			return {
				...client
			}
		};
	`;

  return indexCode;
}
