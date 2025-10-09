import { defineConfig } from 'tsup';

export default defineConfig([
  // Main package build
  {
    entry: [
      'src/index.ts',
      'src/plugins/anonymous/index.ts',
      'src/plugins/email-password/index.ts',
      'src/plugins/email-or-username/index.ts',
      'src/plugins/jwt/index.ts',
      'src/plugins/phone/index.ts',
      'src/plugins/api-key/index.ts',
      'src/plugins/organization/index.ts',
      'src/plugins/passwordless/index.ts',
      'src/plugins/session/index.ts',
      'src/plugins/username/index.ts',
      'src/plugins/admin/index.ts',
      'src/services/index.ts',
    ],
    format: ['esm', 'cjs'],
    sourcemap: false,
    dts: true,
    clean: true,
    splitting: false,
    outDir: 'dist',
    tsconfig: './tsconfig.json',
  },
  // CLI build (ESM only, with shebang)
  // {
  //   entry: ['src/cli/index.ts'],
  //   format: ['esm'],
  //   sourcemap: false,
  //   dts: false,
  //   clean: false,
  //   splitting: false,
  //   outDir: 'dist/cli',
  //   tsconfig: './tsconfig.json',
  //   banner: {
  //     js: '#!/usr/bin/env node',
  //   },
  // },
]);
