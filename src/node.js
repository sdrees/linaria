// @flow

import type { SourceMapGenerator } from 'source-map';

const glob = require('glob');
const fs = require('fs');
const { transformFileSync } = require('@babel/core');
const transform = require('./transform');

function resolveFile(file: string) {
  return glob.sync(file, { absolute: true });
}

type Options = {
  babelOptions?: Object,
  sourceMaps?: boolean,
};

type Output = {
  [key: string]: { css: string, map: ?SourceMapGenerator },
};

module.exports = function processFiles(
  files: string | string[],
  options: Options = {}
): Output {
  const resolvedFiles = [];
  if (Array.isArray(files)) {
    files.forEach(file => {
      resolvedFiles.push(...resolveFile(file));
    });
  } else {
    resolvedFiles.push(...resolveFile(files));
  }

  const { babelOptions, sourceMaps = false } = options;
  return resolvedFiles.reduce((output, filename: string) => {
    const { code } = transformFileSync(filename, babelOptions);
    const { css, map } = transform(filename, code, sourceMaps);

    if (!css) {
      return output;
    }

    if (map) {
      map.setSourceContent(filename, fs.readFileSync(filename).toString());
    }

    return {
      ...output,
      [filename]: { css, map: map ? map.toString() : null },
    };
  }, {});
};
