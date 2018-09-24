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
      '  --help, -h            Show help                        [boolean]',
      '  --source-maps, -s     Generate source maps             [boolean]',
      '  --require-css, -r     Require CSS in original JS file  [boolean]',
      '  --out-dir, -o         Output directory                 [string]',
      '  --config, -c          Path to Babel config file         string]',
      '',
      'Example:',
      '  linaria -m ./file1.js ./file2.js',
      '  linaria -o dist src/**/*.js',
    ].join('\n')
  );
} else {
  const sourceMaps = Boolean(args.s || args.sourceMaps);
  const outDir = path.resolve(args.o || args.outDir || '');
  const requireCss = Boolean(args.r || args.requireCss);
  const config = args.c || args.config;

  const styles = processFile(args._, {
    sourceMaps,
    babelConfig: config
      ? {
          configFile: config,
        }
      : undefined,
  });

  Object.keys(styles).forEach(jsFilename => {
    const folderStructure = path.relative(
      process.cwd(),
      path.dirname(jsFilename)
    );
    const cssFilename = path
      .basename(jsFilename)
      .replace(path.extname(jsFilename), '.css');
    const cssOutput = path.join(outDir, folderStructure, cssFilename);

    // Skip writing if the file already exists and the new CSS code is empty.
    if (!fs.existsSync(cssOutput) || styles[jsFilename].css) {
      mkdir.sync(path.dirname(cssOutput));
      // Add source mapping URL
      const cssContent = styles[jsFilename].map
        ? `${
            styles[jsFilename].css
          }\n/*# sourceMappingURL=${cssFilename}.map */`
        : styles[jsFilename].css;

      fs.writeFileSync(cssOutput, cssContent);

      // Add require to original JS file to import extracted CSS.
      if (requireCss) {
        fs.writeFileSync(
          jsFilename,
          `${fs.readFileSync(jsFilename).toString()}\nrequire('${path.relative(
            path.dirname(jsFilename),
            cssOutput
          )}');`
        );
      }

      if (styles[jsFilename].map) {
        fs.writeFileSync(`${cssOutput}.map`, styles[jsFilename].map);
      }
    }
  });

  console.log(`Generated ${Object.keys(styles).length} CSS files in ${outDir}`);
}
