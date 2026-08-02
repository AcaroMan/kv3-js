'use strict';

const fs = require('fs');
const path = require('path');
const { parse } = require('./src/parser');
const { stringify } = require('./src/serializer');
const { KV3Header } = require('./src/header');

function parseFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return parse(text);
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
