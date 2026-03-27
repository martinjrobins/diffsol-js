#!/usr/bin/env node

const esbuild = require('esbuild');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

async function build() {
  try {
    console.log('Cleaning dist directory...');
    await fs.promises.rm(path.join(__dirname, 'dist'), { recursive: true, force: true });

    // Generate TypeScript declarations first
    console.log('Generating TypeScript declarations...');
    await execAsync('tsc -p tsconfig.build.json --emitDeclarationOnly --outDir dist');

    // Bundle with esbuild
    console.log('Bundling with esbuild...');
    await esbuild.build({
      entryPoints: ['src/index.ts'],
      bundle: true,
      platform: 'browser',
      target: 'es2021',
      format: 'cjs',
      outfile: 'dist/index.js',
      sourcemap: true,
      external: ['plotly.js'],
      loader: {
        '.wasm': 'file',
      },
    });

    // Also build ESM version
    console.log('Building ESM version...');
    await esbuild.build({
      entryPoints: ['src/index.ts'],
      bundle: true,
      platform: 'browser',
      target: 'es2021',
      format: 'esm',
      outfile: 'dist/index.mjs',
      sourcemap: true,
      external: ['plotly.js'],
      loader: {
        '.wasm': 'file',
      },
    });

    // Build minified CDN-ready bundle (IIFE for global usage)
    console.log('Building minified CDN bundle...');
    await esbuild.build({
      entryPoints: ['src/index.ts'],
      bundle: true,
      platform: 'browser',
      target: 'es2020',
      format: 'iife',
      globalName: 'diffsol',
      outfile: 'dist/diffsol.min.js',
      minify: true,
      sourcemap: 'external',
      external: ['plotly.js'],
      loader: {
        '.wasm': 'file',
      },
    });

    // Copy CSS assets
    console.log('Copying CSS assets...');
    await fs.promises.copyFile(
      path.join(__dirname, 'src', 'interactive-solver.css'),
      path.join(__dirname, 'dist', 'interactive-solver.css')
    );

    console.log('✓ Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
