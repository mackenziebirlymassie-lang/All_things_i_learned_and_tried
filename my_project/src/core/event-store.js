'use strict';

const crypto = require('node:crypto');

class Aggregate {
  constructor(id, state = {}) {
    this.id = id;
    this.state = structuredClone(state);
    this.version = 0;
    this.uncommitted = [];
  }

  apply(event, reducer) {
    this.state = reducer(this.state, event);
    this.version += 1;
    return this;
  }

  record(type, payload, reducer) {
    const event = { id: crypto.randomBytes(8).toString('hex'), aggregateId: this.id, type, payload: structuredClone(payload), version: this.version + this.uncommitted.length + 1, timestamp: new Date().toISOString() };
    this.apply(event, reducer);
    this.uncommitted.push(event);
    return event;
  }

  commit() {
    const events = this.uncommitted;
    this.uncommitted = [];
    return events;
  }
}

class EventStore {
  constructor(options = {}) {
    this.events = [];
    this.snapshots = new Map();
    this.reducers = new Map();
    this.maxEvents = options.maxEvents || 100000;
  }

  register(type, reducer) {
    if (typeof reducer !== 'function') throw new TypeError('Reducer must be a function');
    this.reducers.set(type, reducer);
    return this;
  }

  append(events) {
    const values = Array.isArray(events) ? events : [events];
    for (const event of values) {
      if (!event || !event.aggregateId || !event.type) throw new TypeError('Invalid event');
      this.events.push(structuredClone(event));
    }
    if (this.events.length > this.maxEvents) this.events.splice(0, this.events.length - this.maxEvents);
    return values;
  }

  load(id, initial = {}) {
    const snapshot = this.snapshots.get(id);
    const aggregate = new Aggregate(id, snapshot ? snapshot.state : initial);
    const startVersion = snapshot ? snapshot.version : 0;
    const events = this.events.filter(event => event.aggregateId === id && event.version > startVersion).sort((a, b) => a.version - b.version);
    for (const event of events) {
      const reducer = this.reducers.get(event.type);
      if (!reducer) throw new Error(`No reducer for event ${event.type}`);
      aggregate.apply(event, reducer);
    }
    return aggregate;
  }

  save(aggregate) {
    this.append(aggregate.commit());
    return aggregate;
  }

  snapshot(aggregate) {
    this.snapshots.set(aggregate.id, { version: aggregate.version, state: structuredClone(aggregate.state), savedAt: new Date().toISOString() });
    return this.snapshots.get(aggregate.id);
  }

  stream(id, options = {}) {
    return this.events.filter(event => event.aggregateId === id && (!options.fromVersion || event.version >= options.fromVersion) && (!options.toVersion || event.version <= options.toVersion));
  }

  counts() {
    const byType = {};
    for (const event of this.events) byType[event.type] = (byType[event.type] || 0) + 1;
    return { total: this.events.length, aggregates: new Set(this.events.map(event => event.aggregateId)).size, byType, snapshots: this.snapshots.size };
  }
}

module.exports = { Aggregate, EventStore };
