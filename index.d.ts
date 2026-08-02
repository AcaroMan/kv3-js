export class KV3Header {
  constructor(options?: {
    encoding?: string;
    encodingVersion?: string;
    format?: string;
    formatVersion?: string;
  });
  encoding: string;
  encodingVersion: string;
  format: string;
  formatVersion: string;
  toString(): string;
  toJSON(): {
    encoding: string;
    encodingVersion: string;
    format: string;
    formatVersion: string;
  };
}

export interface ParseResult {
  value: any;
  header: KV3Header | null;
}

export interface StringifyOptions {
  headerMode?: 'default' | 'omit' | 'preserve' | 'custom';
  header?: string | KV3Header;
  indent?: number;
}

export function parseKV3(text: string): ParseResult;
export function stringifyKV3(value: any, options?: StringifyOptions): string;
export function parseKV3File(filePath: string): ParseResult;
export function stringifyKV3File(filePath: string, value: any, options?: StringifyOptions): string;
