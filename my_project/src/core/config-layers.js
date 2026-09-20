'use strict';

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function merge(base, overlay) {
  if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) return clone(overlay);
  const result = { ...(base && typeof base === 'object' ? base : {}) };
  for (const [key, value] of Object.entries(overlay)) {
    if (value === undefined) continue;
    if (value && typeof value === 'object' && !Array.isArray(value) && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) result[key] = merge(result[key], value);
    else result[key] = clone(value);
  }
  return result;
}

function interpolate(value, variables = process.env) {
  if (typeof value === 'string') return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, key) => variables[key] ?? '');
  if (Array.isArray(value)) return value.map(item => interpolate(item, variables));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolate(item, variables)]));
  return value;
}

class ConfigLayers {
  constructor(options = {}) {
    this.layers = [];
    this.schema = options.schema || null;
    this.sources = new Map();
  }

  add(name, values, options = {}) {
    if (this.sources.has(name)) throw new Error(`Configuration layer exists: ${name}`);
    this.sources.set(name, { name, values: clone(values || {}), priority: options.priority || 0, enabled: options.enabled !== false });
    return this;
  }

  remove(name) {
    this.sources.delete(name);
    return this;
  }

  enable(name, enabled = true) {
    const source = this.sources.get(name);
    if (!source) throw new Error(`Configuration layer not found: ${name}`);
    source.enabled = enabled;
    return this;
  }

  resolve(options = {}) {
    const ordered = [...this.sources.values()].filter(source => source.enabled).sort((a, b) => a.priority - b.priority);
    let result = {};
    for (const source of ordered) result = merge(result, source.values);
    result = interpolate(result, options.variables || process.env);
    if (this.schema) result = this.schema.assert(result);
    return result;
  }

  explain(path) {
    return [...this.sources.values()].filter(source => source.enabled).map(source => ({ name: source.name, priority: source.priority, value: String(path).split('.').reduce((value, key) => value == null ? undefined : value[key], source.values) })).filter(item => item.value !== undefined);
  }

  snapshot() {
    return [...this.sources.values()].map(source => ({ name: source.name, priority: source.priority, enabled: source.enabled, values: clone(source.values) }));
  }
}

class ConfigWatcher {
  constructor(layers, callback, options = {}) {
    this.layers = layers;
    this.callback = callback;
    this.intervalMs = options.intervalMs || 1000;
    this.last = JSON.stringify(layers.resolve());
  }

  check() {
    const current = JSON.stringify(this.layers.resolve());
    if (current === this.last) return false;
    const previous = JSON.parse(this.last);
    this.last = current;
    this.callback(JSON.parse(current), previous);
    return true;
  }

  start() {
    if (this.timer) return this;
    this.timer = setInterval(() => this.check(), this.intervalMs);
    this.timer.unref?.();
    return this;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    return this;
  }
}

module.exports = { merge, interpolate, ConfigLayers, ConfigWatcher };
