#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { jsonSchemaToZod } from "json-schema-to-zod";
import prettier from "prettier";
import { program } from "commander";
import axios from "axios";

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

type HttpClient = "axios" | "fetch";

program
	.version("0.0.1")
	.description(
		"A CLI to generate a ReAuth TypeScript SDK from an introspection endpoint.",
	)
	.requiredOption("-u, --url <url>", "URL of the introspection endpoint.")
	.requiredOption(
		"-o, --output <path>",
		"Output directory for the generated SDK.",
	)
	.requiredOption("-k, --key <key>", "Key to use for the generated SDK.")
	.option("-c, --client <client>", "HTTP client to use (axios|fetch)", "fetch")
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
		if (!["axios", "fetch"].includes(options.client)) {
			throw new Error(
				'Invalid client option. Must be either "axios" or "fetch".',
			);
		}

		console.log("🚀 Fetching introspection data from:", options.url);
		console.log("🔧 Using HTTP client:", options.client);

		const response = await axios.get(options.url, {
			headers: {
				"x-reauth-key": options.key,
			},
		});
		const introspectionData = response.data.data;

		const { entity, plugins } = introspectionData;
		const outputDir = options.output;
		const pluginsDir = path.join(outputDir, "plugins");

		// Create directories
		await fs.mkdir(pluginsDir, { recursive: true });

		// Generate entity schema file
		let entitySchemaCode = `import { z } from 'zod';\n\n`;
		entitySchemaCode += `export ${jsonSchemaToZod(entity, { name: "entitySchema" })}\n`;
		const formattedEntitySchema = await prettier.format(entitySchemaCode, {
			parser: "typescript",
			semi: true,
			singleQuote: true,
			trailingComma: "all",
		});
		await fs.writeFile(
			path.join(outputDir, "schemas.ts"),
			formattedEntitySchema,
		);

		const pluginFileNames: string[] = [];

		// Generate a file for each plugin
		for (const plugin of plugins) {
			const pluginName = plugin.name.replace(/-/g, "_");
			const fileName = `${plugin.name}.ts`;
			pluginFileNames.push(fileName);

			let pluginCode: string;

			if (options.client === "axios") {
				pluginCode = generateAxiosPluginCode(plugin, pluginName);
			} else {
				pluginCode = generateFetchPluginCode(plugin, pluginName);
			}

			const formattedPluginCode = await prettier.format(pluginCode, {
				parser: "typescript",
				semi: true,
				singleQuote: true,
				trailingComma: "all",
			});
			await fs.writeFile(path.join(pluginsDir, fileName), formattedPluginCode);
		}

		// Generate main index.ts
		let indexCode: string;
		if (options.client === "axios") {
			indexCode = generateAxiosIndexCode(pluginFileNames);
		} else {
			indexCode = generateFetchIndexCode(pluginFileNames);
		}

		const formattedIndexCode = await prettier.format(indexCode, {
			parser: "typescript",
			semi: true,
			singleQuote: true,
			trailingComma: "all",
		});
		await fs.writeFile(path.join(outputDir, "index.ts"), formattedIndexCode);

		console.log("✅ SDK generated successfully!");
		console.log(`✅ Output directory: ${outputDir}`);
		console.log(`✅ HTTP client: ${options.client}`);
	} catch (error) {
		console.error("Error generating SDK:", error);
		process.exit(1);
	}
}

function generateAxiosPluginCode(
	plugin: PluginDefinition,
	pluginName: string,
): string {
	let pluginCode = `
		import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
		import { z } from 'zod';
	\n\n`;

	const stepMethods: string[] = [];

	for (const step of plugin.steps) {
		const stepName = step.name.replace(/-/g, "_");
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
				const token = await getToken();
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
		export const create${pluginName.charAt(0).toUpperCase() + pluginName.slice(1)}Endpoints = (api: AxiosInstance, getToken: () => Promise<string | null>, config: any) => ({
			${stepMethods.join(",\n")}
		});
	`;

	return pluginCode;
}

function generateFetchPluginCode(
	plugin: PluginDefinition,
	pluginName: string,
): string {
	let pluginCode = `
		import { z } from 'zod';
		import fetch from 'cross-fetch';
	\n\n`;

	const stepMethods: string[] = [];

	for (const step of plugin.steps) {
		const stepName = step.name.replace(/-/g, "_");
		const inputSchemaName = `${pluginName}_${stepName}_inputSchema`;
		const outputSchemaName = `${pluginName}_${stepName}_outputSchema`;

		pluginCode += `export ${jsonSchemaToZod(step.inputs, { name: inputSchemaName })}\n`;
		pluginCode += `export ${jsonSchemaToZod(step.outputs, { name: outputSchemaName })}\n\n`;

		const apiPostLogic = step.requiresAuth
			? `
				const token = await getToken();
				const headers: Record<string, string> = {
					'Content-Type': 'application/json',
					...config.headers,
				};
				if (token) {
					headers.Authorization = \`Bearer \${token}\`;
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
				const response = await fetch(\`\${config.baseURL}/auth/${plugin.name}/${step.name}\`,request);`
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
				const response = await fetch(\`\${config.baseURL}/auth/${plugin.name}/${step.name}\`, request);`;

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
					const data = ${outputSchemaName}.parse(responseData);
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
		export const create${pluginName.charAt(0).toUpperCase() + pluginName.slice(1)}Endpoints = (config: any, getToken: () => Promise<string | null>, responseInterceptor?: (response: Response) => Promise<Response>) => ({
			${stepMethods.join(",\n")}
		});
	`;

	return pluginCode;
}

function generateAxiosIndexCode(pluginFileNames: string[]): string {
	let indexCode = `
		import axios from 'axios';
		import type { AxiosInstance, AxiosRequestConfig } from 'axios';
	`;

	for (const fileName of pluginFileNames) {
		const pluginName = fileName.replace(".ts", "").replace(/-/g, "_");
		const functionName = `create${pluginName.charAt(0).toUpperCase() + pluginName.slice(1)}Endpoints`;
		indexCode += `import { ${functionName} } from './plugins/${fileName.replace(".ts", "")}';\n`;
	}

	indexCode += `
		interface AuthClientConfig {
			baseURL?: string;
			axiosInstance?: AxiosInstance;
			axiosConfig?: AxiosRequestConfig;
			auth?: {
				type: 'localstorage' | 'sessionstorage' | 'cookie' | 'custom';
				key?: string;
				getToken?: () => Promise<string | null> | string | null;
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

			const getToken = async (): Promise<string | null> => {
				if (!config.auth || typeof window === 'undefined' || config.auth.type === 'cookie') return null;
				const { type, key, getToken: customGetToken } = config.auth;
				if (customGetToken) {
					return await customGetToken();
				}
				switch (type) {
					case 'localstorage': return localStorage.getItem(key || 'reauth-token');
					case 'sessionstorage': return sessionStorage.getItem(key || 'reauth-token');
					default: return null;
				}
			};

			const client = {
	`;

	for (const fileName of pluginFileNames) {
		const pluginName = fileName.replace(".ts", "").replace(/-/g, "_");
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

function generateFetchIndexCode(pluginFileNames: string[]): string {
	let indexCode = `
		
	`;

	for (const fileName of pluginFileNames) {
		const pluginName = fileName.replace(".ts", "").replace(/-/g, "_");
		const functionName = `create${pluginName.charAt(0).toUpperCase() + pluginName.slice(1)}Endpoints`;
		indexCode += `import { ${functionName} } from './plugins/${fileName.replace(".ts", "")}';\n`;
	}

	indexCode += `
		interface AuthClientConfig {
			baseURL: string;
			headers?: Record<string, string>;
			fetchConfig?: RequestInit;
			auth?: {
				type: 'localstorage' | 'sessionstorage' | 'cookie' | 'custom';
				key?: string;
				getToken?: () => Promise<string | null> | string | null;
			},
			responseInterceptor?: (response: Response) => Promise<Response>;
		}

		export const createReAuthClient = (config: AuthClientConfig) => {
			if (!config.baseURL) {
				throw new Error('baseURL must be provided when using fetch client.');
			}

			const getToken = async (): Promise<string | null> => {
				if (!config.auth) return null;
				const { type, key, getToken: customGetToken } = config.auth;
				if (customGetToken) {
					return await customGetToken();
				}
				switch (type) {
					case 'localstorage': return localStorage.getItem(key || 'reauth-token');
					case 'sessionstorage': return sessionStorage.getItem(key || 'reauth-token');
					default: return null;
				}
			};

			const client = {
	`;

	for (const fileName of pluginFileNames) {
		const pluginName = fileName.replace(".ts", "").replace(/-/g, "_");
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
