'use strict';
class Cache {
  constructor(ttlMs = 60000) { this.ttlMs = ttlMs; this.items = new Map(); }
  set(key, value, ttlMs = this.ttlMs) { this.items.set(key, { value, expires: Date.now() + ttlMs }); return value; }
  get(key) { const item = this.items.get(key); if (!item || item.expires < Date.now()) { this.items.delete(key); return undefined; } return item.value; }
  has(key) { return this.get(key) !== undefined; }
  delete(key) { return this.items.delete(key); }
  clear() { this.items.clear(); }
}
module.exports = { Cache };
