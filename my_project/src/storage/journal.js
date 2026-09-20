'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

class JournalEntry {
  constructor(input = {}) { this.sequence = input.sequence || 0; this.id = input.id || crypto.randomBytes(8).toString('hex'); this.type = input.type || 'unknown'; this.payload = input.payload || {}; this.timestamp = input.timestamp || new Date().toISOString(); this.previous = input.previous || null; this.hash = input.hash || null; }
  seal() { this.hash = crypto.createHash('sha256').update(JSON.stringify({ sequence: this.sequence, id: this.id, type: this.type, payload: this.payload, timestamp: this.timestamp, previous: this.previous })).digest('hex'); return this; }
}

class AppendOnlyJournal {
  constructor(options = {}) { this.file = options.file || null; this.fs = options.fs || fs; this.entries = []; this.load(); }
  load() { if (!this.file || !this.fs.existsSync(this.file)) return this; const lines = this.fs.readFileSync(this.file, 'utf8').split(/\r?\n/).filter(Boolean); this.entries = lines.map(line => new JournalEntry(JSON.parse(line))); return this; }
  append(type, payload) { const previous = this.entries.at(-1); const entry = new JournalEntry({ sequence: this.entries.length + 1, type, payload, previous: previous?.hash || null }).seal(); this.entries.push(entry); if (this.file) { this.fs.mkdirSync(path.dirname(this.file), { recursive: true }); this.fs.appendFileSync(this.file, `${JSON.stringify(entry)}\n`); } return entry; }
  verify() { let previous = null; for (const entry of this.entries) { const expected = new JournalEntry(entry).seal().hash; if (entry.hash !== expected || entry.previous !== previous || entry.sequence !== this.entries.indexOf(entry) + 1) return { valid: false, entry }; previous = entry.hash; } return { valid: true, entries: this.entries.length }; }
  since(sequence = 0) { return this.entries.filter(entry => entry.sequence > sequence); }
  replay(handler, options = {}) { for (const entry of this.since(options.since)) handler(entry); return this.entries.length; }
  compact(predicate) { this.entries = this.entries.filter(predicate); if (this.file) { this.fs.writeFileSync(this.file, this.entries.map(entry => JSON.stringify(entry)).join('\n') + (this.entries.length ? '\n' : '')); } return this.entries.length; }
}

module.exports = { JournalEntry, AppendOnlyJournal };
