'use strict';

const fs = require('node:fs');
const readline = require('node:readline');

class JsonLinesWriter {
  constructor(file, options = {}) { this.file = file; this.fs = options.fs || fs; this.count = 0; this.bytes = 0; }
  append(value) {
    const line = `${JSON.stringify(value)}\n`;
    this.fs.appendFileSync(this.file, line);
    this.count += 1;
    this.bytes += Buffer.byteLength(line);
    return this;
  }
  appendMany(values) { for (const value of values) this.append(value); return this; }
  stats() { return { count: this.count, bytes: this.bytes, file: this.file }; }
}

async function* readJsonLines(file, options = {}) {
  const maxLineBytes = options.maxLineBytes || 1024 * 1024;
  const input = fs.createReadStream(file, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let lineNumber = 0;
  try {
    for await (const line of lines) {
      lineNumber += 1;
      if (Buffer.byteLength(line) > maxLineBytes) throw new Error(`JSON line ${lineNumber} exceeds limit`);
      if (!line.trim()) continue;
      try { yield JSON.parse(line); } catch (error) { throw new Error(`Invalid JSON at line ${lineNumber}: ${error.message}`); }
    }
  } finally { lines.close(); input.destroy(); }
}

async function collectJsonLines(file, options = {}) {
  const values = [];
  for await (const value of readJsonLines(file, options)) values.push(value);
  return values;
}

async function mapJsonLines(file, mapper, options = {}) {
  const values = [];
  let index = 0;
  for await (const value of readJsonLines(file, options)) values.push(await mapper(value, index++));
  return values;
}

module.exports = { JsonLinesWriter, readJsonLines, collectJsonLines, mapJsonLines };
