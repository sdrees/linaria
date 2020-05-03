/**
 * This file exposes transform function that:
 * - parse the passed code to AST
 * - transforms the AST using Linaria babel preset ('./babel/index.js) and additional config defined in Linaria config file or passed to bundler configuration.
 * - runs generated CSS files through default of user-defined preprocessor
 * - generates source maps for CSS files
 * - return transformed code (without Linaria template literals), generated CSS, source maps and babel metadata from transform step.
 */

import path from 'path';
import * as babel from '@babel/core';
import stylis from 'stylis';
import { SourceMapGenerator, Mapping } from 'source-map';
import loadOptions from './babel/utils/loadOptions';
import { debug } from './babel/utils/logger';
import { LinariaMetadata, Options, PreprocessorFn, Result } from './types';

const STYLIS_DECLARATION = 1;
const posixSep = path.posix.sep;
const babelPreset = require.resolve('./babel');

export function transformUrl(
  url: string,
  outputFilename: string,
  sourceFilename: string,
  platformPath: typeof path = path
) {
  // Replace asset path with new path relative to the output CSS
  const relative = platformPath.relative(
    platformPath.dirname(outputFilename),
    // Get the absolute path to the asset from the path relative to the JS file
    platformPath.resolve(platformPath.dirname(sourceFilename), url)
  );

  if (platformPath.sep === posixSep) {
    return relative;
  }

  return relative.split(platformPath.sep).join(posixSep);
}

export default function transform(code: string, options: Options): Result {
  // Check if the file contains `css` or `styled` words first
  // Otherwise we should skip transforming
  if (!/\b(styled|css)/.test(code)) {
    return {
      code,
      sourceMap: options.inputSourceMap,
    };
  }

  debug(
    'transform',
    `${options.filename} to ${options.outputFilename}\n${code}`
  );

  const pluginOptions = loadOptions(options.pluginOptions);

  // Parse the code first so babel uses user's babel config for parsing
  // We don't want to use user's config when transforming the code
  const ast = babel.parseSync(code, {
    ...(pluginOptions?.babelOptions ?? null),
    filename: options.filename,
    caller: { name: 'linaria' },
  });

  const { metadata, code: transformedCode, map } = babel.transformFromAstSync(
    ast!,
    code,
    {
      filename: options.filename,
      presets: [[babelPreset, pluginOptions]],
      babelrc: false,
      configFile: false,
      sourceMaps: true,
      sourceFileName: options.filename,
      inputSourceMap: options.inputSourceMap,
    }
  )!;

  if (
    !metadata ||
    !(metadata as babel.BabelFileMetadata & { linaria: LinariaMetadata })
      .linaria
  ) {
    return {
      code,
      sourceMap: options.inputSourceMap,
    };
  }

  const {
    rules,
    replacements,
    dependencies,
  } = (metadata as babel.BabelFileMetadata & {
    linaria: LinariaMetadata;
  }).linaria;
  const mappings: Mapping[] = [];

  let cssText = '';

  let preprocessor: PreprocessorFn;
  if (typeof options.preprocessor === 'function') {
    // eslint-disable-next-line prefer-destructuring
    preprocessor = options.preprocessor;
  } else {
    switch (options.preprocessor) {
      case 'none':
        preprocessor = (selector, text) => `${selector} {${text}}\n`;
        break;
      case 'stylis':
      default:
        stylis.use(null)((context, decl) => {
          const { outputFilename } = options;
          if (context === STYLIS_DECLARATION && outputFilename) {
            // When writing to a file, we need to adjust the relative paths inside url(..) expressions
            // It'll allow css-loader to resolve an imported asset properly
            return decl.replace(
              /\b(url\((["']?))(\.[^)]+?)(\2\))/g,
              (match, p1, p2, p3, p4) =>
                p1 + transformUrl(p3, outputFilename, options.filename) + p4
            );
          }

          return decl;
        });

        preprocessor = stylis;
    }
  }

  Object.keys(rules).forEach((selector, index) => {
    mappings.push({
      generated: {
        line: index + 1,
        column: 0,
      },
      original: rules[selector].start!,
      name: selector,
      source: '',
    });

    // Run each rule through stylis to support nesting
    cssText += `${preprocessor(selector, rules[selector].cssText)}\n`;
  });

  return {
    code: transformedCode || '',
    cssText,
    rules,
    replacements,
    dependencies,
    sourceMap: map
      ? {
          ...map,
          version: map.version.toString(),
        }
      : null,

    get cssSourceMapText() {
      if (mappings?.length) {
        const generator = new SourceMapGenerator({
          file: options.filename.replace(/\.js$/, '.css'),
        });

        mappings.forEach(mapping =>
          generator.addMapping(
            Object.assign({}, mapping, { source: options.filename })
          )
        );

        generator.setSourceContent(options.filename, code);

        return generator.toString();
      }

      return '';
    },
  };
}
