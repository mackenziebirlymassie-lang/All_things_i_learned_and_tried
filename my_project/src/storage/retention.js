'use strict';

class RetentionPolicy {
  constructor(options = {}) { this.maxAgeMs = options.maxAgeMs || 30 * 86400000; this.maxCount = options.maxCount || 100; this.statuses = new Set(options.statuses || ['completed', 'failed', 'cancelled']); }
  select(items, now = Date.now()) {
    const eligible = items.filter(item => this.statuses.has(item.status) && item.finishedAt && now - Date.parse(item.finishedAt) > this.maxAgeMs).sort((a, b) => Date.parse(a.finishedAt) - Date.parse(b.finishedAt));
    return eligible.length > this.maxCount ? eligible.slice(0, eligible.length - this.maxCount) : eligible;
  }
  apply(items, remove, now = Date.now()) { const selected = this.select(items, now); for (const item of selected) remove(item); return { removed: selected.length, ids: selected.map(item => item.id) }; }
}

class Compactor {
  constructor(options = {}) { this.policy = options.policy || new RetentionPolicy(options); }
  compact(repository, now = Date.now()) {
    const tasks = [...repository.tasks.values()];
    const result = this.policy.apply(tasks, task => repository.tasks.delete(task.id), now);
    if (result.removed && repository.persist) repository.persist();
    return result;
  }
}

module.exports = { RetentionPolicy, Compactor };
