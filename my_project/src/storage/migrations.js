'use strict';

const fs = require('node:fs');
const path = require('node:path');

class MigrationRunner {
  constructor(options = {}) { this.version = options.version || 1; this.migrations = new Map(); }
  register(version, migrate, description = '') { if (!Number.isInteger(version) || version < 1 || typeof migrate !== 'function') throw new TypeError('Invalid migration'); this.migrations.set(version, { migrate, description }); return this; }
  apply(state, target = this.version) {
    let current = Number(state.version || 0);
    const history = [];
    while (current < target) {
      const next = current + 1; const migration = this.migrations.get(next);
      if (!migration) throw new Error(`Missing migration ${next}`);
      state = migration.migrate(state); state.version = next; history.push({ version: next, description: migration.description });
      current = next;
    }
    return { state, history };
  }
}

class BackupManager {
  constructor(options = {}) { this.directory = path.resolve(options.directory || path.join(process.cwd(), '.flowforge-backups')); this.keep = options.keep || 10; }
  create(file, label = 'manual') {
    if (!fs.existsSync(file)) throw new Error(`Cannot back up missing file: ${file}`);
    fs.mkdirSync(this.directory, { recursive: true });
    const safe = label.replace(/[^a-z0-9_-]/gi, '_');
    const target = path.join(this.directory, `${safe}-${Date.now()}.json`);
    fs.copyFileSync(file, target); this.prune();
    return target;
  }
  list() { if (!fs.existsSync(this.directory)) return []; return fs.readdirSync(this.directory).filter(file => file.endsWith('.json')).map(file => ({ file, path: path.join(this.directory, file), createdAt: fs.statSync(path.join(this.directory, file)).mtime.toISOString() })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  prune() { for (const item of this.list().slice(this.keep)) fs.rmSync(item.path, { force: true }); }
  restore(backup, destination) { if (!fs.existsSync(backup)) throw new Error('Backup does not exist'); fs.copyFileSync(backup, destination); return destination; }
}

module.exports = { MigrationRunner, BackupManager };
