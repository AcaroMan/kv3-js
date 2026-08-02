'use strict';

const { KV3Header } = require('./header');

/**
 * Stringify a JavaScript value to KV3 text.
 *
 * @param {*} value - The value to serialize.
 * @param {object} [options]
 * @param {'default'|'omit'|'preserve'|'custom'} [options.headerMode='default'] -
 *   Controls how the KV3 header is handled.
 * @param {string|object} [options.header] - Custom header string or a KV3Header instance. Used when headerMode is 'custom'.
 * @param {number} [options.indent=2] - Number of spaces per indent level.
 * @returns {string} KV3 formatted text.
 */
function stringify(value, options = {}) {
  const headerMode = options.headerMode || 'default';
  const indent = options.indent !== undefined ? options.indent : 2;
  const customHeader = options.header;

  let header = null;
  if (headerMode === 'custom') {
    header = resolveHeader(customHeader) ?? new KV3Header().toString();
  } else if (headerMode === 'default') {
    header = new KV3Header().toString();
  }

  const body = serializeValue(value, 0, indent);
  return header ? `${header}\n${body}\n` : `${body}\n`;
}

function resolveHeader(header) {
  if (!header) return null;
  if (typeof header === 'string') return header;
  if (typeof header.toString === 'function') return header.toString();
  return null;
}

// ---------------------------------------------------------------------------
// Internal serializer helpers
// ---------------------------------------------------------------------------

function serializeValue(value, depth, indent) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    // Emit floats with a decimal point so KV3 readers see the correct type.
    return Number.isInteger(value) ? String(value) : String(value);
  }
  if (typeof value === 'string') {
    return serializeString(value);
  }
  if (Array.isArray(value)) {
    return serializeArray(value, depth, indent);
  }
  if (typeof value === 'object') {
    // KV3 flag preserved from parse: { __kv3_TYPENAME: "value" }
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0].startsWith('__kv3_')) {
      const typeName = keys[0].slice(6); // strip '__kv3_'
      if (typeName === 'binary') {
        const hex = value.__kv3_binary;
        const bytes = hex.match(/.{1,2}/g) || [];
        return `#[ ${bytes.join(' ')} ]`;
      }
      return `${typeName}:${serializeString(value[keys[0]])}`;
    }
    return serializeObject(value, depth, indent);
  }
  throw new TypeError(`Cannot serialize value of type ${typeof value}`);
}

function serializeString(str) {
  if (str.includes('\n')) {
    return `"""\n${str}\n"""`;
  }

  let escaped = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '\\') {
      escaped += '\\\\';
    } else if (ch === '"') {
      escaped += '\\"';
    } else if (ch === '\r') {
      escaped += '\\r';
    } else if (ch === '\t') {
      escaped += '\\t';
    } else {
      escaped += ch;
    }
  }

  return `"${escaped}"`;
}

function serializeArray(arr, depth, indent) {
  if (arr.length === 0) return '[]';

  const pad = ' '.repeat((depth + 1) * indent);
  const closePad = ' '.repeat(depth * indent);

  const items = arr
    .map((item) => `${pad}${serializeValue(item, depth + 1, indent)}`)
    .join(',\n');

  return `[\n${items},\n${closePad}]`;
}

function serializeObject(obj, depth, indent) {
  const keys = Object.keys(obj);
  if (keys.length === 0) return '{}';

  const pad = ' '.repeat((depth + 1) * indent);
  const closePad = ' '.repeat(depth * indent);

  const pairs = keys.map((key) => {
    const safeKey = /^[A-Za-z_][\w]*$/.test(key) ? key : serializeString(key);
    const val = serializeValue(obj[key], depth + 1, indent);
    return `${pad}${safeKey} = ${val}`;
  });

  return `{\n${pairs.join('\n')}\n${closePad}}`;
}

module.exports = { stringify };
