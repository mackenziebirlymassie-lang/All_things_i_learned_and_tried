'use strict';

const { EventEmitter } = require('node:events');

class HealthCheck {
  constructor(name, check, options = {}) { this.name = name; this.check = check; this.timeoutMs = options.timeoutMs || 5000; this.critical = options.critical !== false; }
  async run() {
    const started = Date.now();
    try {
      const result = await Promise.race([Promise.resolve().then(() => this.check()), new Promise((_, reject) => setTimeout(() => reject(new Error('health check timed out')), this.timeoutMs))]);
      return { name: this.name, ok: result !== false, critical: this.critical, durationMs: Date.now() - started, details: result === true || result === undefined ? {} : result };
    } catch (error) { return { name: this.name, ok: false, critical: this.critical, durationMs: Date.now() - started, error: error.message }; }
  }
}

class HealthRegistry extends EventEmitter {
  constructor(options = {}) { super(); this.checks = new Map(); this.cacheMs = options.cacheMs || 0; this.last = null; }
  register(name, check, options) { this.checks.set(name, check instanceof HealthCheck ? check : new HealthCheck(name, check, options)); return this; }
  unregister(name) { return this.checks.delete(name); }
  async run(options = {}) {
    if (!options.force && this.last && Date.now() - this.last.at < this.cacheMs) return this.last.result;
    const checks = await Promise.all([...this.checks.values()].map(check => check.run()));
    const result = { ok: checks.every(check => !check.critical || check.ok), at: new Date().toISOString(), checks };
    this.last = { at: Date.now(), result };
    this.emit('complete', result);
    return result;
  }
  summary() { if (!this.last) return { status: 'unknown', checks: 0 }; return { status: this.last.result.ok ? 'healthy' : 'unhealthy', checks: this.last.result.checks.length, at: this.last.result.at }; }
}

class ReadinessGate {
  constructor(registry) { this.registry = registry; this.ready = false; this.result = null; }
  async evaluate() { this.result = await this.registry.run({ force: true }); this.ready = this.result.ok; return this.ready; }
  assert() { if (!this.ready) throw new Error('Service is not ready'); return true; }
}

module.exports = { HealthCheck, HealthRegistry, ReadinessGate };
