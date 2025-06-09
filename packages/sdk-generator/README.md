# ReAuth SDK Generator

This package contains a CLI tool to generate a fully type-safe TypeScript SDK for your ReAuth-powered application by fetching introspection data from a running ReAuth server instance.

## How it Works

The generator connects to a specified introspection endpoint on your ReAuth server. It retrieves metadata about your authentication setup, including all registered plugins, their available methods (steps), and the data schemas (inputs and outputs) for each method.

Based on this data, it generates a complete, multi-file TypeScript client with:

- Zod schemas for all request and response payloads.
- A dedicated file for each plugin, containing its specific API methods.
- A main client factory function (`createReAuthClient`) that assembles the full client.
- Type definitions for all operations.

## Usage

To use the generator, you need to have your ReAuth server running with an exposed introspection endpoint.

### From the Command Line

You can run the generator directly using `pnpm` from the root of the monorepo.

```bash
pnpm --filter=@re-auth/sdk-generator generate:sdk
```

By default, this uses the `generate:sdk` script in `package.json`, which is configured to point to a local development server.

### CLI Options

You can also run the generator with custom options:

```bash
node packages/sdk-generator/dist/index.js --url <introspection-url> --output <output-path>
```

- `--url <introspection-url>`: **(Required)** The full URL of the ReAuth introspection endpoint.
- `--output <output-path>`: **(Required)** The directory where the generated SDK will be saved. Defaults to `apps/web/src/lib/reauth-client`.

**Example:**

```bash
node packages/sdk-generator/dist/index.js --url http://localhost:3001/test-introspection --output ./my-sdk
```

## Generated Client Structure

The generator creates a directory with the following structure:

```
<output-path>/
├── plugins/
│   ├── email-password.ts
│   └── ... (other plugin files)
├── schemas.ts
└── index.ts
```

- `index.ts`: The main entry point for the client. It exports the `createReAuthClient` factory function.
- `schemas.ts`: Contains the Zod schema for the core `Entity`.
- `plugins/`: This directory contains a separate TypeScript file for each of your ReAuth plugins (e.g., `email-password.ts`). Each file exports the Zod schemas for its steps and a function to create the endpoint methods for that plugin.
