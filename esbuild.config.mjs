import esbuild from 'esbuild';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const outdir = path.resolve('./dist');

async function build() {
  // Extension host bundle
  await esbuild.build({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: path.join(outdir, 'extension.js'),
    external: ['vscode'],
    sourcemap: false,
    target: ['node18'],
    logLevel: 'info'
  });

  // Webview bundle
  const webviewEntry = path.resolve('webview/src/index.tsx');
  await esbuild.build({
    entryPoints: [webviewEntry],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    outfile: path.join(outdir, 'webview.js'),
    jsx: 'automatic',
    sourcemap: false,
    target: ['es2022'],
    logLevel: 'info'
  });

  // Ensure dist/schemas exists and copy schema(s)
  const srcSchemaDir = path.resolve('src/schemas');
  const distSchemaDir = path.join(outdir, 'schemas');
  await fs.mkdir(distSchemaDir, { recursive: true });
  try {
    const entries = await fs.readdir(srcSchemaDir);
    await Promise.all(entries.filter(e => e.endsWith('.json')).map(file => fs.copyFile(path.join(srcSchemaDir, file), path.join(distSchemaDir, file))));
    console.log(`[copy] Schemas copied to ${distSchemaDir}`);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      console.warn('[copy] No schemas found to copy.');
    } else {
      throw err;
    }
  }
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
