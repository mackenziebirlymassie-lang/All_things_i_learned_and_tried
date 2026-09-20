'use strict';
const fs = require('node:fs');
const path = require('node:path');
class Config {
  constructor(values = {}, file = path.join(process.cwd(), '.flowforge.json')) { this.file = file; this.values = { concurrency: 3, retries: 2, timeoutMs: 30000, dataFile: path.join(process.cwd(), '.flowforge-data.json'), logLevel: 'info', ...values }; }
  load() { if (fs.existsSync(this.file)) this.values = { ...this.values, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) }; return this; }
  save() { fs.writeFileSync(this.file, JSON.stringify(this.values, null, 2)); return this; }
  get(key, fallback) { return this.values[key] === undefined ? fallback : this.values[key]; }
  set(key, value) { this.values[key] = value; return this; }
  toJSON() { return { ...this.values }; }
}
module.exports = { Config };
