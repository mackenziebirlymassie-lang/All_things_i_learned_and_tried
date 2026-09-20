'use strict';

class PluginContext {
  constructor(options = {}) { this.name = options.name || 'plugin'; this.logger = options.logger || console; this.metrics = options.metrics; this.config = options.config || {}; this.commands = new Map(); this.handlers = new Map(); this.hooks = new Map(); }
  command(name, handler) { if (this.commands.has(name)) throw new Error(`Command already registered: ${name}`); this.commands.set(name, handler); return this; }
  handler(name, handler) { if (this.handlers.has(name)) throw new Error(`Handler already registered: ${name}`); this.handlers.set(name, handler); return this; }
  hook(event, listener) { const listeners = this.hooks.get(event) || []; listeners.push(listener); this.hooks.set(event, listeners); return () => this.hooks.set(event, listeners.filter(value => value !== listener)); }
  async emit(event, payload) { for (const listener of this.hooks.get(event) || []) await listener(payload); return payload; }
}

class PluginHost {
  constructor(options = {}) { this.options = options; this.plugins = new Map(); this.contexts = new Map(); }
  load(plugin) {
    if (!plugin || typeof plugin.name !== 'string' || typeof plugin.activate !== 'function') throw new TypeError('Plugin requires name and activate');
    if (this.plugins.has(plugin.name)) throw new Error(`Plugin already loaded: ${plugin.name}`);
    const context = new PluginContext({ ...this.options, name: plugin.name });
    plugin.activate(context); this.plugins.set(plugin.name, plugin); this.contexts.set(plugin.name, context); return context;
  }
  unload(name) { const plugin = this.plugins.get(name); const context = this.contexts.get(name); if (!plugin) return false; plugin.deactivate?.(context); this.plugins.delete(name); this.contexts.delete(name); return true; }
  command(name) { for (const context of this.contexts.values()) if (context.commands.has(name)) return context.commands.get(name); return null; }
  handler(name) { for (const context of this.contexts.values()) if (context.handlers.has(name)) return context.handlers.get(name); return null; }
  list() { return [...this.plugins.keys()]; }
}

const examples = {
  echo: { name: 'echo', activate(context) { context.handler('echo', async ({ task }) => ({ taskId: task.id, message: task.metadata.message || task.title })); } },
  statistics: { name: 'statistics', activate(context) { context.command('stats', async ({ repository }) => ({ tasks: repository.tasks.size, workflows: repository.workflows.size })); } }
};

module.exports = { PluginContext, PluginHost, examples };
