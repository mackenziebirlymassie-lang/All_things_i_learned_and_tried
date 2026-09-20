'use strict';
const fs = require('node:fs');
class JsonStorage {
  constructor(file) { this.file = file; }
  read(fallback = {}) { try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; } }
  write(value) { fs.writeFileSync(this.file, JSON.stringify(value, null, 2)); return value; }
  update(mutator, fallback = {}) { const value = mutator(this.read(fallback)); return this.write(value); }
  export(destination) { fs.copyFileSync(this.file, destination); }
  import(source) { fs.copyFileSync(source, this.file); return this.read(); }
}
module.exports = { JsonStorage };
