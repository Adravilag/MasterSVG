const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * esbuild plugin that loads template files (.html, .css, and .js inside
 * the templates/ directory) as raw text strings so they are bundled
 * directly into extension.js — no runtime I/O needed.
 *
 * @type {import('esbuild').Plugin}
 */
const templateTextPlugin = {
  name: 'template-text',
  setup(build) {
    // .html and .css files → always load as text
    build.onLoad({ filter: /\.(html|css)$/ }, async (args) => {
      const text = await fs.promises.readFile(args.path, 'utf8');
      return { contents: text, loader: 'text' };
    });

    // .js files inside a templates/ directory → load as text (they are
    // template strings, not executable JavaScript)
    build.onLoad({ filter: /templates[/\\].*\.js$/ }, async (args) => {
      const text = await fs.promises.readFile(args.path, 'utf8');
      return { contents: text, loader: 'text' };
    });
  },
};

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',
  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        if (location) {
          console.error(`    ${location.file}:${location.line}:${location.column}:`);
        }
      });
      console.log('[watch] build finished');
    });
  },
};

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: true,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'silent',
    plugins: [templateTextPlugin, esbuildProblemMatcherPlugin],
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
