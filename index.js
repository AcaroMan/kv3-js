'use strict';

const fs = require('fs');
const path = require('path');
const { parse } = require('./src/parser');
const { stringify } = require('./src/serializer');
const { KV3Header } = require('./src/header');

function parseFile(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    return parse(text);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      throw new Error(`Failed to read KV3 file: ${filePath}`);
    }
    throw err;
  }
}

function stringifyFile(filePath, value, options = {}) {
  const text = stringify(value, options);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, 'utf8');
  return text;
}


module.exports = {
  parseKV3: parse,
  stringifyKV3: stringify,
  parseKV3File: parseFile,
  stringifyKV3File: stringifyFile,
  KV3Header,
};
