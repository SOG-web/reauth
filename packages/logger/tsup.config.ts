import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  sourcemap: true,
  dts: true,
  clean: true,
  splitting: false,
  outDir: 'dist',
  tsconfig: './tsconfig.json',
});
