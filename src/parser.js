'use strict';

const { parseHeader, KV3Header } = require('./header');

const TYPED_REF_RE = /^([A-Za-z_]\w*):/;
const PRIMITIVE_TERMINATORS = new Set([' ', '\n', '\r', '\t', '=', '{', '}', '[', ']', ',']);

/**
 * Parse a KV3 text string into a JavaScript value.
 *
 * @param {string} text - The full KV3 file content.
 * @returns {{ value: *, header: KV3Header|null }} Parsed value plus optional header metadata.
 * @throws {SyntaxError} If the KV3 is malformed.
 */
function parse(text) {
  if (typeof text !== 'string') {
    throw new TypeError('KV3 input must be a string');
  }

  let header = null;

  const parsedHeader = parseHeader(text);
  if (parsedHeader) {
    header = parsedHeader.header;
    text = text.slice(parsedHeader.length);
  }

  const parser = new Parser(text);
  parser.skipWhitespaceAndComments();
  const value = parser.readValue();
  parser.skipWhitespaceAndComments();

  if (parser.i < parser.text.length) {
    throw parser.error(`Unexpected content after root value`);
  }

  return { value, header };
}

// ---------------------------------------------------------------------------
// Internal parser class
// ---------------------------------------------------------------------------

class Parser {
  constructor(text) {
    this.text = text;
    this.i = 0;
    this.length = text.length;
  }

  error(msg) {
    const lines = this.text.slice(0, this.i).split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    return new SyntaxError(`KV3 parse error at ${line}:${col}: ${msg}`);
  }

  peek(offset = 0) {
    return this.text[this.i + offset];
  }

  peekSequence(length) {
    return this.text.slice(this.i, this.i + length);
  }

  isAtEnd() {
    return this.i >= this.length;
  }

  advance(steps = 1) {
    const ch = this.peek();
    this.i += steps;
    return ch;
  }

  consume(expected) {
    if (this.peek() !== expected) {
      return false;
    }
    this.advance();
    return true;
  }

  skipWhitespaceAndComments() {
    while (!this.isAtEnd()) {
      const ch = this.peek();

      if (/\s/.test(ch)) {
        this.advance();
        continue;
      }

      if (ch === '/' && this.peek(1) === '/') {
        while (!this.isAtEnd() && this.peek() !== '\n') {
          this.advance();
        }
        continue;
      }

      if (ch === '/' && this.peek(1) === '*') {
        this.advance(2);

        while (!this.isAtEnd()) {
          if (this.peek() === '*' && this.peek(1) === '/') {
            this.advance(2);
            break;
          }
          this.advance();
        }
        continue;
      }

      break;
    }
  }

  readValue() {
    this.skipWhitespaceAndComments();
    const ch = this.peek();

    if (ch === '{') {
      return this.readObject();
    }

    if (ch === '[') {
      return this.readArray();
    }

    if (this.peekSequence(3) === '"""') {
      return this.readMultilineString();
    }

    if (ch === '"') {
      return this.readQuotedString();
    }

    if (this.peek() === '#' && this.peek(1) === '[') {
      return this.readBinaryArray();
    }

    const typedRefLen = this._matchTypedRef();
    if (typedRefLen > 0) {
      const typeName = this.peekSequence(typedRefLen);
      this.advance(typedRefLen + 1);
      this.skipWhitespaceAndComments();
      const refValue = this.readQuotedString();
      return { [`__kv3_${typeName}`]: refValue };
    }

    return this.readPrimitive();
  }

  readMultilineString() {
    this.advance(3);
    let s = '';

    while (!this.isAtEnd()) {
      if (this.peekSequence(3) === '"""') {
        this.advance(3);
        return s.replace(/^\n/, '').replace(/\n$/, '');
      }
      s += this.peek();
      this.advance();
    }
    throw this.error('Unterminated multiline string');
  }

  readQuotedString() {
    if (this.peek() !== '"') {
      throw this.error(`Expected '"', got '${this.peek()}'`);
    }
    this.advance();

    let s = '';
    while (!this.isAtEnd()) {
      const ch = this.peek();
      if (ch === '"') {
        this.advance();
        return s;
      }
      if (ch === '\\') {
        this.advance();
        const esc = this.peek();
        if (esc === 'u') {
          const hex = this.text.slice(this.i + 1, this.i + 5);
          if (/^[0-9A-Fa-f]{4}$/.test(hex)) {
            s += String.fromCharCode(parseInt(hex, 16));
            this.advance(5);
            continue;
          }
          throw this.error('Invalid unicode escape sequence');
        }
        switch (esc) {
          case '"':  s += '"';  break;
          case '\\': s += '\\'; break;
          case 'n':  s += '\n'; break;
          case 'r':  s += '\r'; break;
          case 't':  s += '\t'; break;
          default:   s += esc;  break;
        }
        this.advance();
        continue;
      }
      s += this.advance();
    }
    throw this.error('Unterminated string');
  }

  readBinaryArray() {
    this.advance(2);
    const hexParts = [];
    while (true) {
      this.skipWhitespaceAndComments();
      if (this.isAtEnd()) throw this.error('Unterminated binary array');
      if (this.peek() === ']') { this.advance(); break; }
      const start = this.i;
      while (!this.isAtEnd() && /[0-9A-Fa-f]/.test(this.peek())) {
        this.advance();
      }
      if (this.i > start) {
        hexParts.push(this.text.slice(start, this.i));
      } else {
        throw this.error(`Unexpected character in binary array: '${this.peek()}'`);
      }
    }
    return { __kv3_binary: hexParts.join('') };
  }

  _matchTypedRef() {
    // Match pattern: identifier: where identifier is [A-Za-z_][\w]*
    // and the character immediately after ":" is a quote OR a { or [ (for
    // object/array typed values like subclass:{...}).
    const rest = this.text.slice(this.i);
    const m = TYPED_REF_RE.exec(rest);
    if (!m) return 0;
    const afterColon = rest.slice(m[0].length).trimStart();
    if (afterColon[0] !== '"' && afterColon[0] !== '{' && afterColon[0] !== '[') return 0;
    return m[1].length;
  }

  readPrimitive() {
    const start = this.i;

    while (!this.isAtEnd()) {
      const ch = this.peek();
      if (PRIMITIVE_TERMINATORS.has(ch)) {
        break;
      }
      if (ch === '/' && (this.peek(1) === '/' || this.peek(1) === '*')) break;
      this.advance();
    }
    const token = this.text.slice(start, this.i);
    if (token === '') {
      throw this.error(`Unexpected character '${this.peek()}'`);
    }

    if (token === 'true')  return true;
    if (token === 'false') return false;
    if (token === 'null')  return null;

    // Integer
    if (/^[+-]?\d+$/.test(token)) return parseInt(token, 10);

    // Float (with optional scientific notation)
    if (/^[+-]?\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(token) ||
        /^[+-]?\d+\.\d*(?:[eE][+-]?\d+)?$/.test(token)) {
      return parseFloat(token);
    }

    // Unquoted string (identifiers, enum values, etc.)
    return token;
  }

  readObject() {
    this.advance();
    const obj = {};

    while (true) {
      this.skipWhitespaceAndComments();
      if (this.isAtEnd()) {
        throw this.error('Unterminated object');
      }
      if (this.peek() === '}') {
        this.advance();
        return obj;
      }

      let key;
      if (this.peek() === '"') {
        key = this.readQuotedString();
      } else {
        key = this.readPrimitive();
      }

      this.skipWhitespaceAndComments();

      let keyFlag = null;
      if (this.peek() === ':') {
        const flagStart = this.i + 1;
        let flagEnd = flagStart;
        while (flagEnd < this.length && /[A-Za-z_]/.test(this.text[flagEnd])) {
          flagEnd++;
        }
        if (flagEnd > flagStart) {
          keyFlag = this.text.slice(flagStart, flagEnd);
          this.i = flagEnd;
          this.skipWhitespaceAndComments();
        }
      }

      if (this.peek() === '=') {
        this.advance();
      }

      let value = this.readValue();
      if (keyFlag && typeof value === 'string') {
        value = { [`__kv3_${keyFlag}`]: value };
      }

      obj[key] = value;
    }
  }

  readArray() {
    this.advance();
    const arr = [];

    while (true) {
      this.skipWhitespaceAndComments();
      if (this.isAtEnd()) {
        throw this.error('Unterminated array');
      }
      if (this.peek() === ']') {
        this.advance();
        return arr;
      }
      if (this.peek() === ',') {
        this.advance();
        continue;
      }
      arr.push(this.readValue());
    }
  }
}

module.exports = { parse };
