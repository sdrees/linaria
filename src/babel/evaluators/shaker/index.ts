import shake from './shaker';
import { debug } from '../../utils/logger';
import generator from '@babel/generator';
import { Evaluator, StrictOptions } from '../../types';
import { transformSync, types } from '@babel/core';
import buildOptions from '../buildOptions';

function prepareForShake(
  filename: string,
  options: StrictOptions,
  code: string
): types.Program {
  const transformOptions = buildOptions(filename, options);

  transformOptions.ast = true;
  transformOptions.presets!.unshift([
    '@babel/preset-env',
    { targets: 'ie 11' },
  ]);
  transformOptions.presets!.unshift([require.resolve('../preeval'), options]);
  transformOptions.plugins!.unshift('transform-react-remove-prop-types');
  transformOptions.plugins!.unshift([
    '@babel/plugin-transform-runtime',
    { useESModules: false },
  ]);

  debug(
    'evaluator:shaker:transform',
    `Transform ${filename} with options ${JSON.stringify(
      transformOptions,
      null,
      2
    )}`
  );
  const transformed = transformSync(code, transformOptions);

  if (transformed === null || !transformed.ast) {
    throw new Error(`${filename} cannot be transformed`);
  }

  return transformed.ast.program;
}

const shaker: Evaluator = (filename, options, text, only = null) => {
  const [shaken, imports] = shake(
    prepareForShake(filename, options, text),
    only
  );

  debug('evaluator:shaker:generate', `Generate shaken source code ${filename}`);
  const { code: shakenCode } = generator(shaken!);
  return [shakenCode, imports];
};

export default shaker;
