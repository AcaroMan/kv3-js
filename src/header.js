'use strict';

const DEFAULT_HEADER_VALUES = Object.freeze({
  encoding: 'text',
  encodingVersion: 'e21c7f3c-8a33-41c5-9977-a76d3a32aa0d',
  format: 'generic',
  formatVersion: '7412167c-06e9-4698-aff2-e63eb59037e7',
});

const HEADER_RE = /^<!--\s*kv3\s+encoding:([\w]+):version\{([^}]+)\}\s*format:([\w]+):version\{([^}]+)\}\s*-->/;

class KV3Header {
  constructor(options = {}) {
    this.encoding = options.encoding || DEFAULT_HEADER_VALUES.encoding;
    this.encodingVersion = options.encodingVersion || DEFAULT_HEADER_VALUES.encodingVersion;
    this.format = options.format || DEFAULT_HEADER_VALUES.format;
    this.formatVersion = options.formatVersion || DEFAULT_HEADER_VALUES.formatVersion;
  }

  toString() {
    return `<!-- kv3 encoding:${this.encoding}:version{${this.encodingVersion}} format:${this.format}:version{${this.formatVersion}} -->`;
  }

  toJSON() {
    return {
      encoding: this.encoding,
      encodingVersion: this.encodingVersion,
      format: this.format,
      formatVersion: this.formatVersion,
    };
  }
}

function parseHeader(text) {
  const match = HEADER_RE.exec(text);
  if (!match) return null;

  const header = new KV3Header({
    encoding: match[1],
    encodingVersion: match[2],
    format: match[3],
    formatVersion: match[4],
  });

  return {
    header,
    length: header.toString().length,
  };
}

function validateHeader(text) {
  return HEADER_RE.test(text);
}

const DEFAULT_HEADER = new KV3Header(DEFAULT_HEADER_VALUES).toString();

module.exports = {
  KV3Header,
  parseHeader,
  validateHeader,
};
