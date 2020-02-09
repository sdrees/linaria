/* @flow */

import path from 'path';
import dedent from 'dedent';
import * as babel from '@babel/core';
import Module from '../babel/module';

beforeEach(() => Module.invalidate());

function transform(text) {
  return babel.transformSync(text, {
    filename: this.filename,
  });
}

it('creates module for JS files', () => {
  const filename = '/foo/bar/test.js';
  const mod = new Module(filename);

  mod.evaluate('module.exports = () => 42');

  expect(mod.exports()).toBe(42);
  expect(mod.id).toBe(filename);
  expect(mod.filename).toBe(filename);
});

it('correctly processes export declarations in strict mode', () => {
  const filename = '/foo/bar/test.js';
  const mod = new Module(filename);

  mod.evaluate('"use strict"; exports = module.exports = () => 42');

  expect(mod.exports()).toBe(42);
  expect(mod.id).toBe(filename);
  expect(mod.filename).toBe(filename);
});

it('requires JS files', () => {
  const mod = new Module(path.resolve(__dirname, '../__fixtures__/test.js'));

  mod.evaluate(dedent`
    const answer = require('./sample-script');

    module.exports = 'The answer is ' + answer;
  `);

  expect(mod.exports).toBe('The answer is 42');
});

it('requires JSON files', () => {
  const mod = new Module(path.resolve(__dirname, '../__fixtures__/test.js'));

  mod.evaluate(dedent`
    const data = require('./sample-data.json');

    module.exports = 'Our saviour, ' + data.name;
  `);

  expect(mod.exports).toBe('Our saviour, Luke Skywalker');
});

it('imports JS files', () => {
  const mod = new Module(path.resolve(__dirname, '../__fixtures__/test.js'));

  mod.transform = transform;
  mod.evaluate(dedent`
    import answer from './sample-script';

    export const result = 'The answer is ' + answer;
  `);

  expect(mod.exports.result).toBe('The answer is 42');
});

it('imports TypeScript files', () => {
  const mod = new Module(path.resolve(__dirname, '../__fixtures__/test.ts'));

  mod.transform = transform;
  mod.evaluate(dedent`
    import answer from './sample-typescript';

    export const result = 'The answer is ' + answer;
  `);

  expect(mod.exports.result).toBe('The answer is 27');
});

it('imports JSON files', () => {
  const mod = new Module(path.resolve(__dirname, '../__fixtures__/test.js'));

  mod.transform = transform;
  mod.evaluate(dedent`
    import data from './sample-data.json';

    const result = 'Our saviour, ' + data.name;

    export default result;
  `);

  expect(mod.exports.default).toBe('Our saviour, Luke Skywalker');
});

it('returns module from the cache', () => {
  /* eslint-disable no-self-compare */

  const filename = path.resolve(__dirname, '../__fixtures__/test.js');
  const mod = new Module(filename);
  const id = './sample-data.json';

  expect(mod.require(id) === mod.require(id)).toBe(true);

  expect(
    new Module(filename).require(id) === new Module(filename).require(id)
  ).toBe(true);
});

it('clears modules from the cache', () => {
  const filename = path.resolve(__dirname, '../__fixtures__/test.js');
  const id = './sample-data.json';

  const result = new Module(filename).require(id);

  expect(result === new Module(filename).require(id)).toBe(true);

  Module.invalidate();

  expect(result === new Module(filename).require(id)).toBe(false);
});

it('exports the path for non JS/JSON files', () => {
  const mod = new Module(path.resolve(__dirname, '../__fixtures__/test.js'));

  expect(mod.require('./sample-asset.png')).toBe('./sample-asset.png');
});

it('returns module when requiring mocked builtin node modules', () => {
  const mod = new Module(path.resolve(__dirname, '../__fixtures__/test.js'));

  expect(mod.require('path')).toBe(require('path'));
});

it('returns null when requiring empty builtin node modules', () => {
  const mod = new Module(path.resolve(__dirname, '../__fixtures__/test.js'));

  expect(mod.require('fs')).toBe(null);
});

it('throws when requiring unmocked builtin node modules', () => {
  const mod = new Module(path.resolve(__dirname, '../__fixtures__/test.js'));

  expect(() => mod.require('perf_hooks')).toThrow(
    'Unable to import "perf_hooks". Importing Node builtins is not supported in the sandbox.'
  );
});

it('has access to the global object', () => {
  const mod = new Module(path.resolve(__dirname, '../__fixtures__/test.js'));

  expect(() =>
    mod.evaluate(dedent`
    new global.Set();
  `)
  ).not.toThrow();
});

it("doesn't have access to the process object", () => {
  const mod = new Module(path.resolve(__dirname, '../__fixtures__/test.js'));

  expect(() =>
    mod.evaluate(dedent`
    process.abort();
  `)
  ).toThrow('process.abort is not a function');
});

it('has access to NODE_ENV', () => {
  const mod = new Module(path.resolve(__dirname, '../__fixtures__/test.js'));

  mod.evaluate(dedent`
  module.exports = process.env.NODE_ENV;
  `);

  expect(mod.exports).toBe(process.env.NODE_ENV);
});

it('has require.resolve available', () => {
  const mod = new Module(path.resolve(__dirname, '../__fixtures__/test.js'));

  mod.evaluate(dedent`
  module.exports = require.resolve('./sample-script');
  `);

  expect(mod.exports).toBe(
    path.resolve(path.dirname(mod.filename), 'sample-script.js')
  );
});

it('has require.ensure available', () => {
  const mod = new Module(path.resolve(__dirname, '../__fixtures__/test.js'));

  expect(() =>
    mod.evaluate(dedent`
  require.ensure(['./sample-script']);
  `)
  ).not.toThrowError();
});

it('has __filename available', () => {
  const mod = new Module(path.resolve(__dirname, '../__fixtures__/test.js'));

  mod.evaluate(dedent`
  module.exports = __filename;
  `);

  expect(mod.exports).toBe(mod.filename);
});

it('has __dirname available', () => {
  const mod = new Module(path.resolve(__dirname, '../__fixtures__/test.js'));

  mod.evaluate(dedent`
  module.exports = __dirname;
  `);

  expect(mod.exports).toBe(path.dirname(mod.filename));
});

it('changes resolve behaviour on overriding _resolveFilename', () => {
  const originalResolveFilename = Module._resolveFilename;

  Module._resolveFilename = id => (id === 'foo' ? 'bar' : id);

  const mod = new Module(path.resolve(__dirname, '../__fixtures__/test.js'));

  mod.evaluate(dedent`
  module.exports = [
    require.resolve('foo'),
    require.resolve('test'),
  ];
  `);

  // Restore old behavior
  Module._resolveFilename = originalResolveFilename;

  expect(mod.exports).toEqual(['bar', 'test']);
});
