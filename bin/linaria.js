#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const mkdir = require('mkdirp');
const parseArgs = require('minimist');
const processFile = require('../lib/node');

const args = parseArgs(process.argv.slice(2));

if (args.h || args.help) {
  console.log(
    [
      'Usage: linaria [options] <file1> [...<fileN>]',
      '',
      'Arguments',
      '  <file1> [...<fileN>]  File paths or glob patterns',
      '',
      'Options:',
      '  --help, -h            Show help                    [boolean]',
      '  --sourceMaps, -m      Generate source maps         [boolean]',
      '  --outDir, -o          Output directory             [string]',
      '  --config, -c          Path to Babel config file    [string]',
      '',
      'Example:',
      '  linaria -m ./file1.js ./file2.js',
      '  linaria -o dist src/**/*.js',
    ].join('\n')
  );
} else {
  const sourceMaps = Boolean(args.m || args.sourceMaps);
  const outDir = path.resolve(args.o || args.outDir || '');
  const config = args.c || args.config;

  const styles = processFile(args._, {
    sourceMaps,
    babelConfig: config
      ? {
          configFile: config,
        }
      : undefined,
  });

  mkdir.sync(outDir);
  Object.keys(styles).forEach(filename => {
    fs.writeFileSync(
      path.join(outDir, path.basename(filename)),
      styles[filename].css
    );
    if (styles[filename].map) {
      fs.writeFileSync(
        path.join(outDir, `${path.basename(filename)}.map`),
        styles[filename].map
      );
    }
  });

  console.log(`Generated ${Object.keys(styles).length} CSS files in ${outDir}`);
}
