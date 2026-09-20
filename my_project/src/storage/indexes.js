'use strict';

class Index {
  constructor(field, options = {}) { this.field = field; this.unique = options.unique === true; this.values = new Map(); }
  value(item) { return typeof this.field === 'function' ? this.field(item) : String(this.field).split('.').reduce((value, key) => value == null ? undefined : value[key], item); }
  add(item) { const key = this.value(item); if (key === undefined) return; if (!this.values.has(key)) this.values.set(key, new Set()); if (this.unique && this.values.get(key).size && !this.values.get(key).has(item.id)) throw new Error(`Unique index violation: ${key}`); this.values.get(key).add(item.id); }
  remove(item) { const key = this.value(item); const values = this.values.get(key); if (!values) return; values.delete(item.id); if (!values.size) this.values.delete(key); }
  lookup(value) { return [...(this.values.get(value) || [])]; }
  clear() { this.values.clear(); return this; }
}

class IndexCollection {
  constructor() { this.indexes = new Map(); this.items = new Map(); }
  create(name, field, options) { if (this.indexes.has(name)) throw new Error(`Index exists: ${name}`); const index = new Index(field, options); this.indexes.set(name, index); for (const item of this.items.values()) index.add(item); return index; }
  add(item) { if (!item.id) throw new Error('Indexed items require id'); if (this.items.has(item.id)) this.remove(item.id); for (const index of this.indexes.values()) index.add(item); this.items.set(item.id, item); return item; }
  update(item) { this.remove(item.id); return this.add(item); }
  remove(id) { const item = this.items.get(id); if (!item) return false; for (const index of this.indexes.values()) index.remove(item); return this.items.delete(id); }
  find(indexName, value) { const index = this.indexes.get(indexName); if (!index) throw new Error(`Index not found: ${indexName}`); return index.lookup(value).map(id => this.items.get(id)); }
  all() { return [...this.items.values()]; }
  rebuild() { for (const index of this.indexes.values()) index.clear(); for (const item of this.items.values()) for (const index of this.indexes.values()) index.add(item); return this; }
}

class QueryCache {
  constructor(options = {}) { this.max = options.max || 1000; this.values = new Map(); }
  get(key) { const value = this.values.get(key); if (!value) return undefined; if (value.expiresAt && value.expiresAt <= Date.now()) { this.values.delete(key); return undefined; } return structuredClone(value.result); }
  set(key, result, ttlMs = 0) { if (this.values.size >= this.max && !this.values.has(key)) this.values.delete(this.values.keys().next().value); this.values.set(key, { result: structuredClone(result), expiresAt: ttlMs ? Date.now() + ttlMs : null }); return result; }
  invalidate(prefix = '') { for (const key of this.values.keys()) if (key.startsWith(prefix)) this.values.delete(key); return this; }
  clear() { this.values.clear(); return this; }
  stats() { return { size: this.values.size, max: this.max }; }
}

module.exports = { Index, IndexCollection, QueryCache };
