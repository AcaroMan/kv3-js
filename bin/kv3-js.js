#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parse, stringify, parseFile, stringifyFile } = require('../index');

function printUsage() {
  console.log('Usage:');
  console.log('  kv3-js parse <file>');
  console.log('  kv3-js stringify <file> [--out <output>]');
  console.log('');
  console.log('Examples:');
  console.log('  kv3-js parse ./example.vmap');
  console.log('  kv3-js stringify ./example.json --out ./example.kv3');
}

function main(argv) {
  const [command, input, ...rest] = argv;

  if (!command || command === '--help' || command === '-h') {
    printUsage();
    return;
  }

  if (command === 'parse') {
    if (!input) {
      console.error('A file path is required.');
      process.exit(1);
    }
    const { value, header } = parseFile(input);
    console.log(JSON.stringify({ value, header }, null, 2));
    return;
  }

  if (command === 'stringify') {
    if (!input) {
      console.error('A file path is required.');
      process.exit(1);
    }

    const outIndex = rest.indexOf('--out');
    const outputPath = outIndex >= 0 ? rest[outIndex + 1] : undefined;
    const text = fs.readFileSync(input, 'utf8');
    const parsed = parse(text);
    const outFile = outputPath || path.join(path.dirname(input), `${path.basename(input, path.extname(input))}.kv3`);
    stringifyFile(outFile, parsed.value, { headerMode: 'omit' });
    console.log(`Wrote ${outFile}`);
    return;
  }

  printUsage();
  process.exit(1);
}

main(process.argv.slice(2));
