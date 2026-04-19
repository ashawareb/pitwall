import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/bin.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  sourcemap: true,
  splitting: false,
  banner: { js: '#!/usr/bin/env node' },
  // Workspace packages are bundled inline so the published CLI is
  // self-contained; third-party runtime deps stay externalized and are
  // resolved via the CLI's own node_modules at install time.
  noExternal: ['@pitwall/server', '@pitwall/parser'],
});
