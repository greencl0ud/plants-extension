import { build } from 'esbuild';

await build({
  entryPoints: ['tests/extension/run.ts'],
  outfile: 'dist/test-extension/run.mjs',
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node22',
});
await build({
  entryPoints: ['tests/extension/host.ts'],
  outfile: 'dist/test-extension/host.cjs',
  bundle: true,
  external: ['vscode'],
  platform: 'node',
  format: 'cjs',
  target: 'node20',
});
