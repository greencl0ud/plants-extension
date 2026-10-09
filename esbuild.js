import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const production = process.argv.includes('--production');
const common = {
  bundle: true,
  minify: production,
  sourcemap: !production,
  logLevel: 'info',
};
const builds = [
  {
    ...common,
    entryPoints: ['src/extension/extension.ts'],
    // Keep the VS Code entry point explicitly CommonJS within this ESM package.
    outfile: 'dist/extension.cjs',
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    external: ['vscode'],
  },
  {
    ...common,
    entryPoints: ['src/webview/main.ts'],
    outfile: 'dist/webview/main.js',
    platform: 'browser',
    format: 'iife',
    target: 'es2022',
  },
];

try {
  if (watch) {
    const contexts = await Promise.all(builds.map((build) => esbuild.context(build)));
    await Promise.all(contexts.map((context) => context.watch()));
    const stop = async () => {
      await Promise.all(contexts.map((context) => context.dispose()));
      process.exit(0);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } else {
    await Promise.all(builds.map((build) => esbuild.build(build)));
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
