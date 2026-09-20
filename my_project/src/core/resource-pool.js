'use strict';

const { EventEmitter } = require('node:events');

class ResourceLease {
  constructor(pool, resource, owner, expiresAt) {
    this.pool = pool;
    this.resource = resource;
    this.owner = owner;
    this.expiresAt = expiresAt;
    this.released = false;
  }

  release() {
    if (this.released) return false;
    this.released = true;
    return this.pool.release(this.resource.id, this.owner);
  }

  expired(now = Date.now()) {
    return this.expiresAt !== null && this.expiresAt <= now;
  }
}

class ResourcePool extends EventEmitter {
  constructor(resources = [], options = {}) {
    super();
    this.ttlMs = options.ttlMs || 300000;
    this.maxWaiters = options.maxWaiters || 1000;
    this.resources = new Map();
    this.waiters = [];
    for (const resource of resources) this.add(resource);
  }

  add(input) {
    const resource = typeof input === 'string' ? { id: input } : { ...input };
    if (!resource.id) throw new TypeError('Resource id is required');
    if (this.resources.has(resource.id)) throw new Error(`Resource already exists: ${resource.id}`);
    this.resources.set(resource.id, { ...resource, state: 'available', owner: null, expiresAt: null, metadata: resource.metadata || {} });
    this.emit('added', resource);
    return resource;
  }

  remove(id) {
    const resource = this.get(id);
    if (resource.state === 'leased') throw new Error(`Resource is leased: ${id}`);
    this.resources.delete(id);
    this.emit('removed', resource);
    return true;
  }

  get(id) {
    const resource = this.resources.get(id);
    if (!resource) throw new Error(`Resource not found: ${id}`);
    return resource;
  }

  available(criteria = {}) {
    this.reapWithoutDispatch();
    return [...this.resources.values()].filter(resource =>
      resource.state === 'available' &&
      (!criteria.kind || resource.kind === criteria.kind) &&
      (!criteria.tags || criteria.tags.every(tag => (resource.tags || []).includes(tag))));
  }

  acquire(owner, criteria = {}) {
    const resource = this.available(criteria)[0];
    if (!resource) return null;
    resource.state = 'leased';
    resource.owner = owner;
    resource.expiresAt = this.ttlMs ? Date.now() + this.ttlMs : null;
    const lease = new ResourceLease(this, resource, owner, resource.expiresAt);
    this.emit('acquired', { resource, owner });
    return lease;
  }

  acquireOrWait(owner, criteria = {}, timeoutMs = 30000) {
    const immediate = this.acquire(owner, criteria);
    if (immediate) return Promise.resolve(immediate);
    if (this.waiters.length >= this.maxWaiters) return Promise.reject(new Error('Resource waiter limit exceeded'));
    return new Promise((resolve, reject) => {
      const waiter = { owner, criteria, resolve, reject, expiresAt: Date.now() + timeoutMs };
      waiter.timer = setTimeout(() => {
        this.waiters = this.waiters.filter(value => value !== waiter);
        reject(new Error('Resource acquisition timed out'));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  release(id, owner) {
    const resource = this.get(id);
    if (resource.state !== 'leased' || resource.owner !== owner) return false;
    resource.state = 'available';
    resource.owner = null;
    resource.expiresAt = null;
    this.emit('released', { resource, owner });
    this.dispatch();
    return true;
  }

  reap(now = Date.now()) {
    for (const resource of this.resources.values()) {
      if (resource.state === 'leased' && resource.expiresAt !== null && resource.expiresAt <= now) {
        const owner = resource.owner;
        resource.state = 'available';
        resource.owner = null;
        resource.expiresAt = null;
        this.emit('expired', { resource, owner });
      }
    }
    this.dispatch();
    return this;
  }

  dispatch() {
    this.reapWithoutDispatch();
    for (const waiter of [...this.waiters]) {
      const lease = this.acquire(waiter.owner, waiter.criteria);
      if (!lease) break;
      this.waiters = this.waiters.filter(value => value !== waiter);
      clearTimeout(waiter.timer);
      waiter.resolve(lease);
    }
  }

  reapWithoutDispatch(now = Date.now()) {
    for (const resource of this.resources.values()) {
      if (resource.state === 'leased' && resource.expiresAt !== null && resource.expiresAt <= now) {
        resource.state = 'available';
        resource.owner = null;
        resource.expiresAt = null;
      }
    }
  }

  stats() {
    this.reapWithoutDispatch();
    const resources = [...this.resources.values()];
    return {
      total: resources.length,
      available: resources.filter(value => value.state === 'available').length,
      leased: resources.filter(value => value.state === 'leased').length,
      waiters: this.waiters.length
    };
  }
}

module.exports = { ResourcePool, ResourceLease };
