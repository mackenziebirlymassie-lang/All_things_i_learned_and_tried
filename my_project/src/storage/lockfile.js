'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

class LockFile {
  constructor(file, options = {}) { this.file = file; this.owner = options.owner || `${process.pid}-${crypto.randomBytes(4).toString('hex')}`; this.ttlMs = options.ttlMs || 30000; this.fs = options.fs || fs; }
  read() { if (!this.fs.existsSync(this.file)) return null; try { return JSON.parse(this.fs.readFileSync(this.file, 'utf8')); } catch { return null; } }
  expired(lock = this.read()) { return !lock || lock.expiresAt <= Date.now(); }
  acquire(options = {}) {
    const current = this.read();
    if (current && !this.expired(current) && current.owner !== this.owner) return false;
    this.fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const lock = { owner: this.owner, acquiredAt: new Date().toISOString(), expiresAt: Date.now() + (options.ttlMs || this.ttlMs) };
    this.fs.writeFileSync(this.file, JSON.stringify(lock));
    const confirmed = this.read();
    return confirmed && confirmed.owner === this.owner;
  }
  refresh() { const current = this.read(); if (!current || current.owner !== this.owner || this.expired(current)) return false; current.expiresAt = Date.now() + this.ttlMs; this.fs.writeFileSync(this.file, JSON.stringify(current)); return true; }
  release() { const current = this.read(); if (!current || current.owner !== this.owner) return false; this.fs.rmSync(this.file, { force: true }); return true; }
  withLock(operation) { if (!this.acquire()) throw new Error('Unable to acquire lock'); return Promise.resolve().then(operation).finally(() => this.release()); }
}

class Lease {
  constructor(lock, intervalMs = 10000) { this.lock = lock; this.intervalMs = intervalMs; this.timer = null; }
  start() { if (this.timer) return this; this.timer = setInterval(() => this.lock.refresh(), this.intervalMs); this.timer.unref?.(); return this; }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; return this; }
}

module.exports = { LockFile, Lease };
