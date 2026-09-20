'use strict';

const crypto = require('node:crypto');

class ScheduleSnapshot {
  constructor(input = {}) {
    this.version = input.version || 1;
    this.createdAt = input.createdAt || new Date().toISOString();
    this.schedules = Array.isArray(input.schedules) ? structuredClone(input.schedules) : [];
    this.dependencies = input.dependencies && typeof input.dependencies === 'object' ? structuredClone(input.dependencies) : {};
    this.queue = Array.isArray(input.queue) ? structuredClone(input.queue) : [];
    this.metadata = input.metadata || {};
  }

  checksum() {
    const body = JSON.stringify({ version: this.version, schedules: this.schedules, dependencies: this.dependencies, queue: this.queue });
    return crypto.createHash('sha256').update(body).digest('hex');
  }

  toJSON() {
    return { version: this.version, createdAt: this.createdAt, schedules: structuredClone(this.schedules), dependencies: structuredClone(this.dependencies), queue: structuredClone(this.queue), metadata: structuredClone(this.metadata), checksum: this.checksum() };
  }
}

class SchedulePersistence {
  constructor(options = {}) {
    this.file = options.file || null;
    this.fs = options.fs || require('node:fs');
    this.snapshot = new ScheduleSnapshot();
  }

  load() {
    if (!this.file || !this.fs.existsSync(this.file)) return this.snapshot;
    const data = JSON.parse(this.fs.readFileSync(this.file, 'utf8'));
    const expected = data.checksum;
    const snapshot = new ScheduleSnapshot(data);
    if (expected && expected !== snapshot.checksum()) throw new Error('Schedule snapshot checksum mismatch');
    this.snapshot = snapshot;
    return snapshot;
  }

  save(input = {}) {
    this.snapshot = new ScheduleSnapshot({
      ...this.snapshot,
      ...input,
      createdAt: new Date().toISOString()
    });
    if (this.file) {
      this.fs.mkdirSync(require('node:path').dirname(this.file), { recursive: true });
      const temporary = `${this.file}.${process.pid}.tmp`;
      this.fs.writeFileSync(temporary, JSON.stringify(this.snapshot.toJSON(), null, 2));
      this.fs.renameSync(temporary, this.file);
    }
    return this.snapshot;
  }

  capture(store, dependencies, queue) {
    return this.save({
      schedules: store.list(),
      dependencies: Object.fromEntries([...dependencies].map(([id, values]) => [id, [...values]])),
      queue: queue ? [...queue.jobs.values()].map(job => job.toJSON()) : []
    });
  }

  restore(store, dependencies, queue) {
    const snapshot = this.load();
    for (const item of snapshot.schedules) store.add(item);
    for (const [id, values] of Object.entries(snapshot.dependencies)) for (const dependency of values) {
      try { dependencies.set(id, new Set([...(dependencies.get(id) || []), dependency])); } catch {}
    }
    if (queue) for (const item of snapshot.queue) if (!queue.jobs.has(item.id)) queue.enqueue(item);
    return snapshot;
  }
}

module.exports = { ScheduleSnapshot, SchedulePersistence };
