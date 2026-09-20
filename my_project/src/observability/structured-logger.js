'use strict';

const util = require('node:util');

const LEVELS = Object.freeze({ trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 });

class StructuredLogger {
  constructor(options = {}) { this.level = options.level || 'info'; this.threshold = LEVELS[this.level] || LEVELS.info; this.fields = options.fields || {}; this.sinks = options.sinks || [entry => process.stderr.write(`${JSON.stringify(entry)}\n`)]; this.redact = new Set(options.redact || ['password', 'token', 'secret', 'authorization']); this.buffer = []; }
  child(fields = {}) { return new StructuredLogger({ level: this.level, fields: { ...this.fields, ...fields }, sinks: this.sinks, redact: [...this.redact] }); }
  sanitize(value, key = '') { if (this.redact.has(key.toLowerCase())) return '[REDACTED]'; if (Array.isArray(value)) return value.map(item => this.sanitize(item)); if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, this.sanitize(item, name)])); return value; }
  write(level, message, fields = {}) { if ((LEVELS[level] || 0) < this.threshold) return null; const entry = { timestamp: new Date().toISOString(), level, message: String(message), ...this.sanitize(this.fields), ...this.sanitize(fields) }; this.buffer.push(entry); if (this.buffer.length > 1000) this.buffer.shift(); for (const sink of this.sinks) try { sink(entry); } catch {} return entry; }
  trace(message, fields) { return this.write('trace', message, fields); }
  debug(message, fields) { return this.write('debug', message, fields); }
  info(message, fields) { return this.write('info', message, fields); }
  warn(message, fields) { return this.write('warn', message, fields); }
  error(message, fields) { return this.write('error', message, fields); }
  fatal(message, fields) { return this.write('fatal', message, fields); }
  query(criteria = {}) { return this.buffer.filter(entry => (!criteria.level || entry.level === criteria.level) && (!criteria.message || entry.message.includes(criteria.message)) && (!criteria.since || entry.timestamp >= criteria.since)); }
  format(entry) { return `${entry.timestamp} ${entry.level.toUpperCase()} ${entry.message} ${util.inspect(entry, { depth: 3, colors: false })}`; }
}

module.exports = { StructuredLogger, LEVELS };
