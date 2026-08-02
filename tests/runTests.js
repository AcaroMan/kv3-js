'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  parseKV3,
  stringifyKV3,
  parseKV3File,
  stringifyKV3File,
} = require('../index');
const { KV3Header, parseHeader } = require('../src/header');

let passed = 0;
let failed = 0;

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL ${name}`);
    console.error(`  ${err.message}`);
    failed++;
  }
}

function assertRoundTrip(value, options) {
  const kv3 = stringifyKV3(value, options);
  const { value: reparsed } = parseKV3(kv3);
  assert.deepStrictEqual(reparsed, value);
}

function withTempFile(contents, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kv3-js-'));
  const file = path.join(dir, 'sample.kv3');
  fs.writeFileSync(file, contents);

  try {
    return fn(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Parser tests
// ---------------------------------------------------------------------------

run('parse: empty object', () => {
  const expectedJsValue = {};
  const { value } = parseKV3('{}');
  assert.deepStrictEqual(value, expectedJsValue);
});

run('parse: basic key-value pairs', () => {
  const expectedJsValue = { name: 'hello', count: 42, flag: true, nothing: null };
  const kv3 = '{ name = "hello" count = 42 flag = true nothing = null }';
  const { value } = parseKV3(kv3);
  assert.deepStrictEqual(value, expectedJsValue);
});

run('parse: nested object', () => {
  const expectedJsValue = { outer: { inner: 'value' } };
  const kv3 = '{ outer = { inner = "value" } }';
  const { value } = parseKV3(kv3);
  assert.deepStrictEqual(value, expectedJsValue);
});

run('parse: array', () => {
  const expectedJsValue = { items: [1, 2, 3] };
  const kv3 = '{ items = [ 1, 2, 3 ] }';
  const { value } = parseKV3(kv3);
  assert.deepStrictEqual(value, expectedJsValue);
});

run('parse: string array', () => {
  const expectedJsValue = { names: ['Alice', 'Bob'] };
  const kv3 = '{ names = [ "Alice", "Bob" ] }';
  const { value } = parseKV3(kv3);
  assert.deepStrictEqual(value, expectedJsValue);
});

run('parse: float', () => {
  const expectedJsValue = { x: 1.5 };
  const { value } = parseKV3('{ x = 1.5 }');
  assert.deepStrictEqual(value, expectedJsValue);
});

run('parse: negative number', () => {
  const expectedJsValue = { x: -10 };
  const { value } = parseKV3('{ x = -10 }');
  assert.deepStrictEqual(value, expectedJsValue);
});

run('parse: escape sequences in string', () => {
  const expectedJsValue = { path: 'C:\\folder\\file.txt' };
  const { value } = parseKV3('{ path = "C:\\\\folder\\\\file.txt" }');
  assert.deepStrictEqual(value, expectedJsValue);
});

run('parse: unicode escape sequences', () => {
  const expectedJsValue = { msg: 'HelloAworld' };
  const { value } = parseKV3('{ msg = "Hello\\u0041world" }');
  assert.deepStrictEqual(value, expectedJsValue);
});

run('parse: multiline string', () => {
  const expectedJsValue = { desc: 'hello\nworld' };
  const kv3 = '{ desc = """\nhello\nworld\n""" }';
  const { value } = parseKV3(kv3);
  assert.deepStrictEqual(value, expectedJsValue);
});

run('parse: line comment', () => {
  const expectedJsValue = { x: 1 };
  const kv3 = `{
    // this is a comment
    x = 1
  }`;
  const { value } = parseKV3(kv3);
  assert.deepStrictEqual(value, expectedJsValue);
});

run('parse: block comment', () => {
  const expectedJsValue = { x: 1 };
  const kv3 = '{ /* block */ x = 1 }';
  const { value } = parseKV3(kv3);
  assert.deepStrictEqual(value, expectedJsValue);
});

run('parse: KV3 Flag reference', () => {
  const expectedJsValue = { model: { __kv3_resource: 'models/hero.vmdl' } };
  const { value } = parseKV3('{ model = resource:"models/hero.vmdl" }');
  assert.deepStrictEqual(value, expectedJsValue);
});


run('parse: KV3 header is extracted', () => {
  const header = new KV3Header();
  const kv3 = [
    header.toString(),
    '{ x = 1 }',
  ].join('\n');
  const { header: parsedHeader, value } = parseKV3(kv3);
  assert.ok(parsedHeader instanceof KV3Header);
  assert.strictEqual(parsedHeader.encoding, header.encoding);
  assert.strictEqual(parsedHeader.format, header.format);
  assert.strictEqual(parsedHeader.toString(), header.toString());
  assert.strictEqual(value.x, 1);
});

run('parseHeader: length uses the canonical header serialization', () => {
  const header = new KV3Header({ encoding: 'text', format: 'generic' });
  const rawHeader = '<!--   kv3   encoding:text:version{e21c7f3c-8a33-41c5-9977-a76d3a32aa0d}   format:generic:version{7412167c-06e9-4698-aff2-e63eb59037e7}   -->';
  const parsed = parseHeader(rawHeader);
  assert.ok(parsed.header instanceof KV3Header);
  assert.strictEqual(parsed.length, header.toString().length);
});

run('parse: null header when no header present', () => {
  const { header } = parseKV3('{ x = 1 }');
  assert.strictEqual(header, null);
});

// ---------------------------------------------------------------------------
// Serializer tests
// ---------------------------------------------------------------------------

run('stringify: empty object', () => {
  assertRoundTrip({});
});

run('stringify: basic values', () => {
  assertRoundTrip({ name: 'hello', count: 42, flag: true, nothing: null });
});

run('stringify: nested object', () => {
  assertRoundTrip({ outer: { inner: 'val' } });
});

run('stringify: array', () => {
  assertRoundTrip({ items: [1, 2, 3] });
});

run('stringify: multiline string for values containing newline', () => {
  assertRoundTrip({ desc: 'line1\nline2' });
});

run('stringify: resource reference round-trip', () => {
  assertRoundTrip({ model: { __kv3_resource: 'models/hero.vmdl' } });
});

run('stringify: includes default header', () => {
  const out = stringifyKV3({ x: 1 });
  assert.ok(out.includes(new KV3Header().toString()));
});

run('stringify: omit header with headerMode omit', () => {
  const out = stringifyKV3({ x: 1 }, { headerMode: 'omit' });
  assert.ok(!out.includes('<!--'));
});

run('stringify: custom header with headerMode custom', () => {
  const out = stringifyKV3({ x: 1 }, { headerMode: 'custom', header: '<!-- custom -->' });
  assert.ok(out.startsWith('<!-- custom -->'));
});

// ---------------------------------------------------------------------------
// Round-trip and public API tests
// ---------------------------------------------------------------------------

run('round-trip: parse then stringify then parse', () => {
  const original = {
    name: 'test',
    count: 7,
    active: true,
    tags: ['a', 'b', 'c'],
    nested: { x: 1.5, y: null },
  };
  assertRoundTrip(original, { headerMode: 'omit' });
});

// ---------------------------------------------------------------------------
// File helper tests
// ---------------------------------------------------------------------------

run('parseFile: reads and parses a file', () => {
  withTempFile('{ x = 1 }', (file) => {
    const { value } = parseKV3File(file);
    assert.deepStrictEqual(value, { x: 1 });
  });
});

run('stringifyFile: writes serialized KV3 to disk', () => {
  withTempFile('', (file) => {
    const jsonValue = { hello: 'world' };
    stringifyKV3File(file, jsonValue, { headerMode: 'omit' });
    const text = fs.readFileSync(file, 'utf8');
    assert.strictEqual(stringifyKV3(jsonValue, { headerMode: 'omit' }), text);
  
  });
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exitCode = 1;
}
