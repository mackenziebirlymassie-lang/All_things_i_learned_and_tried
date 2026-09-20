'use strict';

class MemoryAdapter {
  constructor(options = {}) { this.values = new Map(); this.maxEntries = options.maxEntries || 10000; this.ttlMs = options.ttlMs || 0; }
  set(key, value, options = {}) { if (this.values.size >= this.maxEntries && !this.values.has(key)) this.evictOne(); this.values.set(String(key), { value: structuredClone(value), expiresAt: options.ttlMs || this.ttlMs ? Date.now() + (options.ttlMs || this.ttlMs) : null, hits: 0, createdAt: Date.now() }); return this; }
  get(key, fallback) { const entry = this.values.get(String(key)); if (!entry) return fallback; if (entry.expiresAt && entry.expiresAt <= Date.now()) { this.values.delete(String(key)); return fallback; } entry.hits += 1; return structuredClone(entry.value); }
  has(key) { return this.get(key, Symbol('missing')) !== undefined; }
  delete(key) { return this.values.delete(String(key)); }
  clear() { this.values.clear(); return this; }
  evictOne() { const oldest = [...this.values].sort((a, b) => a[1].hits - b[1].hits || a[1].createdAt - b[1].createdAt)[0]; if (oldest) this.values.delete(oldest[0]); }
  keys() { return [...this.values.keys()]; }
  entries() { return this.keys().map(key => [key, this.get(key)]); }
  stats() { return { size: this.values.size, maxEntries: this.maxEntries, keys: this.keys() }; }
}

class LockManager {
  constructor() { this.locks = new Map(); }
  acquire(key, owner, ttlMs = 30000) { const current = this.locks.get(key); if (current && current.expiresAt > Date.now() && current.owner !== owner) return false; this.locks.set(key, { owner, expiresAt: Date.now() + ttlMs }); return true; }
  release(key, owner) { const current = this.locks.get(key); if (!current || current.owner !== owner) return false; this.locks.delete(key); return true; }
  refresh(key, owner, ttlMs = 30000) { if (!this.acquire(key, owner, ttlMs)) return false; return true; }
  inspect(key) { const current = this.locks.get(key); if (!current || current.expiresAt <= Date.now()) { this.locks.delete(key); return null; } return { ...current }; }
}

module.exports = { MemoryAdapter, LockManager };
