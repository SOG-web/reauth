import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'base-adapter': 'src/base-adapter.ts',
    'adapters/express': 'src/adapters/express.ts',
    'adapters/fastify': 'src/adapters/fastify.ts',
    'adapters/hono': 'src/adapters/hono.ts',
    'adapters/itty-router': 'src/adapters/itty-router.ts',
    'middleware/security': 'src/middleware/security.ts',
    'utils/factory': 'src/utils/factory.ts',
    types: 'src/types.ts',
  },
  format: ['esm', 'cjs'],
  sourcemap: true,
  dts: true,
  clean: true,
  splitting: false,
  outDir: 'dist',
  tsconfig: './tsconfig.json',
  external: [
    '@re-auth/reauth',
    'express',
    'fastify',
    'hono',
    'itty-router',
    'cors',
    'express-rate-limit',
    'helmet',
    'zod',
  ],
  treeshake: true,
  minify: false, // Keep readable for debugging
  banner: {
    js: '"use strict";',
  },
});
