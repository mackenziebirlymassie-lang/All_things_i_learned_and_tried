'use strict';

const crypto = require('node:crypto');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}

function digest(value, algorithm = 'sha256') {
  return crypto.createHash(algorithm).update(JSON.stringify(stable(value))).digest('hex');
}

class IntegrityManifest {
  constructor(input = {}) { this.algorithm = input.algorithm || 'sha256'; this.createdAt = input.createdAt || new Date().toISOString(); this.entries = input.entries || {}; }
  add(name, value) { this.entries[name] = digest(value, this.algorithm); return this; }
  verify(name, value) { if (!this.entries[name]) return { ok: false, reason: 'missing' }; const actual = digest(value, this.algorithm); return { ok: actual === this.entries[name], expected: this.entries[name], actual }; }
  verifyAll(values) { return Object.fromEntries(Object.entries(values).map(([name, value]) => [name, this.verify(name, value)])); }
  toJSON() { return { algorithm: this.algorithm, createdAt: this.createdAt, entries: { ...this.entries } }; }
}

class StateValidator {
  constructor(options = {}) { this.maxTasks = options.maxTasks || 100000; this.maxEvents = options.maxEvents || 200000; }
  validate(state) {
    const errors = [];
    if (!state || typeof state !== 'object') errors.push('state must be an object');
    if (!state.tasks || typeof state.tasks !== 'object') errors.push('tasks must be an object');
    if (!state.workflows || typeof state.workflows !== 'object') errors.push('workflows must be an object');
    if (!Array.isArray(state.events)) errors.push('events must be an array');
    if (state.tasks && Object.keys(state.tasks).length > this.maxTasks) errors.push('task limit exceeded');
    if (state.events && state.events.length > this.maxEvents) errors.push('event limit exceeded');
    const taskIds = new Set(Object.keys(state.tasks || {}));
    for (const [id, task] of Object.entries(state.tasks || {})) {
      if (task.id !== id) errors.push(`task key mismatch: ${id}`);
      for (const dependency of task.dependencies || []) if (!taskIds.has(dependency)) errors.push(`missing dependency ${dependency} for ${id}`);
    }
    for (const [id, workflow] of Object.entries(state.workflows || {})) {
      if (workflow.id !== id) errors.push(`workflow key mismatch: ${id}`);
      for (const taskId of workflow.taskIds || []) if (!taskIds.has(taskId)) errors.push(`missing workflow task ${taskId}`);
    }
    return { valid: errors.length === 0, errors };
  }
  assert(state) { const result = this.validate(state); if (!result.valid) throw new Error(`Invalid state: ${result.errors.join('; ')}`); return state; }
}

module.exports = { stable, digest, IntegrityManifest, StateValidator };
