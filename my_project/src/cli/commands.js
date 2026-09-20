'use strict';

const { AnalyticsQuery } = require('../analytics/query');
const { query } = require('../analytics/dsl');
const { BackupManager } = require('../storage/migrations');
const { Compactor } = require('../storage/retention');

class CommandRouter {
  constructor(app, options = {}) { this.app = app; this.commands = new Map(); this.registerDefaults(); this.logger = options.logger || console; }
  register(name, handler, metadata = {}) { if (this.commands.has(name)) throw new Error(`Command exists: ${name}`); this.commands.set(name, { handler, metadata }); return this; }
  registerDefaults() {
    this.register('analytics', async options => new AnalyticsQuery(this.app.repository).report(), { description: 'Detailed analytics report' });
    this.register('search', async options => query([...this.app.repository.tasks.values()]).where('title', 'contains', options.term || '').orderBy('createdAt', 'desc').paginate(options.offset, options.limit).run(), { description: 'Query tasks' });
    this.register('queue', async options => this.app.queue?.stats() || { available: false }, { description: 'Queue statistics' });
    this.register('backup', async options => new BackupManager({ directory: options.directory }).create(this.app.store.filePath || this.app.store.file, options.label || 'flowforge'), { description: 'Create backup' });
    this.register('compact', async options => new Compactor(options).compact(this.app.repository), { description: 'Apply retention policy' });
    this.register('health', async options => this.app.health?.run({ force: true }) || { ok: true }, { description: 'Run health checks' });
  }
  async execute(name, options = {}) { const command = this.commands.get(name); if (!command) throw new Error(`Unknown command: ${name}`); return command.handler(options); }
  help() { return [...this.commands].map(([name, value]) => `${name.padEnd(12)} ${value.metadata.description || ''}`).join('\n'); }
}

module.exports = { CommandRouter };
