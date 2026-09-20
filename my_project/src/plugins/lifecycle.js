'use strict';

const { EventEmitter } = require('node:events');
const { CapabilityPolicy, PluginVerifier, AuditLog } = require('./security');

class LifecycleContext {
  constructor(options = {}) {
    this.name = options.name;
    this.policy = options.policy || new CapabilityPolicy();
    this.audit = options.audit || new AuditLog();
    this.logger = options.logger || { info() {}, warn() {}, error() {} };
    this.registrations = [];
    this.state = new Map();
  }
  require(capability) { this.policy.check(capability); return this; }
  register(kind, name, value) { this.registrations.push({ kind, name, value }); this.audit.record('register', { plugin: this.name, kind, name }); return value; }
  get(key, fallback) { return this.state.has(key) ? this.state.get(key) : fallback; }
  set(key, value) { this.state.set(key, value); return value; }
}

class LifecyclePluginHost extends EventEmitter {
  constructor(options = {}) {
    super();
    this.verifier = options.verifier || new PluginVerifier(options);
    this.policy = options.policy || new CapabilityPolicy(options);
    this.audit = options.audit || new AuditLog();
    this.plugins = new Map();
  }
  async install(plugin, options = {}) {
    this.verifier.verify(plugin);
    if (this.plugins.has(plugin.name)) throw new Error(`Plugin already installed: ${plugin.name}`);
    const policy = new CapabilityPolicy({ allowed: [...this.policy.allowed], denied: [...this.policy.denied] });
    for (const capability of plugin.capabilities || []) policy.check(capability);
    const context = new LifecycleContext({ name: plugin.name, policy, audit: this.audit, logger: options.logger });
    const record = { plugin, context, status: 'installed', installedAt: new Date().toISOString(), activatedAt: null, deactivatedAt: null, error: null };
    this.plugins.set(plugin.name, record);
    this.audit.record('install', { plugin: plugin.name, version: plugin.version });
    this.emit('installed', record);
    if (options.activate !== false) await this.activate(plugin.name);
    return record;
  }
  async activate(name) {
    const record = this.get(name);
    if (record.status === 'active') return record;
    try {
      if (typeof record.plugin.activate === 'function') await record.plugin.activate(record.context);
      record.status = 'active'; record.activatedAt = new Date().toISOString();
      this.audit.record('activate', { plugin: name }); this.emit('activated', record);
      return record;
    } catch (error) { record.status = 'failed'; record.error = { message: error.message, stack: error.stack }; this.audit.record('activate-failed', { plugin: name, message: error.message }); throw error; }
  }
  async deactivate(name) {
    const record = this.get(name);
    if (record.status !== 'active') return record;
    if (typeof record.plugin.deactivate === 'function') await record.plugin.deactivate(record.context);
    record.status = 'inactive'; record.deactivatedAt = new Date().toISOString(); this.audit.record('deactivate', { plugin: name }); this.emit('deactivated', record); return record;
  }
  async uninstall(name) { const record = this.get(name); await this.deactivate(name); this.plugins.delete(name); this.audit.record('uninstall', { plugin: name }); this.emit('uninstalled', record); return true; }
  get(name) { const value = this.plugins.get(name); if (!value) throw new Error(`Plugin not found: ${name}`); return value; }
  list(status) { return [...this.plugins.values()].filter(record => !status || record.status === status).map(record => ({ name: record.plugin.name, version: record.plugin.version, status: record.status, installedAt: record.installedAt })); }
  health() { const values = [...this.plugins.values()]; return { total: values.length, active: values.filter(value => value.status === 'active').length, failed: values.filter(value => value.status === 'failed').length, auditEntries: this.audit.entries.length }; }
}

module.exports = { LifecycleContext, LifecyclePluginHost };
