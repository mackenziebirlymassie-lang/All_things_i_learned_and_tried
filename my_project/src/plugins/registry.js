'use strict';
const { HandlerRegistry } = require('../core/engine');
class PluginRegistry extends HandlerRegistry {
  constructor() { super(); this.plugins = new Map(); }
  registerPlugin(plugin) { if (!plugin || typeof plugin.name !== 'string') throw new TypeError('Plugin requires a name'); if (this.plugins.has(plugin.name)) throw new Error(`Plugin already registered: ${plugin.name}`); this.plugins.set(plugin.name, plugin); if (typeof plugin.setup === 'function') plugin.setup(this); return plugin; }
  unregisterPlugin(name) { const plugin = this.plugins.get(name); if (plugin && typeof plugin.teardown === 'function') plugin.teardown(this); return this.plugins.delete(name); }
  listPlugins() { return [...this.plugins.keys()]; }
}
module.exports = { PluginRegistry };
