'use strict';

const { EventEmitter } = require('node:events');
const crypto = require('node:crypto');

function queueId(prefix = 'job') {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`;
}

class QueueJob {
  constructor(input = {}) {
    if (!input.workflowId) throw new TypeError('workflowId is required');
    this.id = input.id || queueId();
    this.workflowId = input.workflowId;
    this.scheduleId = input.scheduleId || null;
    this.payload = input.payload && typeof input.payload === 'object' ? structuredClone(input.payload) : {};
    this.priority = Number.isFinite(Number(input.priority)) ? Number(input.priority) : 0;
    this.maxAttempts = Math.max(1, Number(input.maxAttempts) || 1);
    this.attempts = Number(input.attempts) || 0;
    this.status = input.status || 'queued';
    this.createdAt = input.createdAt || new Date().toISOString();
    this.availableAt = input.availableAt || this.createdAt;
    this.startedAt = input.startedAt || null;
    this.finishedAt = input.finishedAt || null;
    this.lockedBy = input.lockedBy || null;
    this.lockedUntil = input.lockedUntil || null;
    this.result = input.result === undefined ? null : structuredClone(input.result);
    this.error = input.error || null;
    this.history = Array.isArray(input.history) ? structuredClone(input.history) : [];
  }

  lock(worker, ttlMs) {
    if (this.status !== 'queued' && this.status !== 'retrying') return false;
    this.status = 'running';
    this.attempts += 1;
    this.startedAt = new Date().toISOString();
    this.lockedBy = worker;
    this.lockedUntil = new Date(Date.now() + ttlMs).toISOString();
    this.history.push({ event: 'started', worker, attempt: this.attempts, at: this.startedAt });
    return true;
  }

  complete(result) {
    this.status = 'completed';
    this.result = result === undefined ? null : structuredClone(result);
    this.finishedAt = new Date().toISOString();
    this.lockedBy = null;
    this.lockedUntil = null;
    this.history.push({ event: 'completed', at: this.finishedAt });
  }

  fail(error, retryDelayMs = 0) {
    this.error = { name: error?.name || 'Error', message: error?.message || String(error), code: error?.code || null };
    this.lockedBy = null;
    this.lockedUntil = null;
    if (this.attempts < this.maxAttempts) {
      this.status = 'retrying';
      this.availableAt = new Date(Date.now() + retryDelayMs).toISOString();
      this.history.push({ event: 'retrying', delayMs: retryDelayMs, at: new Date().toISOString() });
    } else {
      this.status = 'failed';
      this.finishedAt = new Date().toISOString();
      this.history.push({ event: 'failed', at: this.finishedAt });
    }
  }

  isExpired(now = Date.now()) {
    return this.lockedUntil && Date.parse(this.lockedUntil) <= now;
  }

  toJSON() {
    return {
      id: this.id, workflowId: this.workflowId, scheduleId: this.scheduleId,
      payload: structuredClone(this.payload), priority: this.priority,
      maxAttempts: this.maxAttempts, attempts: this.attempts, status: this.status,
      createdAt: this.createdAt, availableAt: this.availableAt, startedAt: this.startedAt,
      finishedAt: this.finishedAt, lockedBy: this.lockedBy, lockedUntil: this.lockedUntil,
      result: structuredClone(this.result), error: this.error, history: structuredClone(this.history)
    };
  }
}

class PersistentQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this.store = options.store || null;
    this.key = options.key || 'queue';
    this.lockTtlMs = options.lockTtlMs || 300000;
    this.maxSize = options.maxSize || 10000;
    this.jobs = new Map();
    this.load();
  }

  load() {
    if (!this.store) return this;
    const data = this.store.load ? this.store.load() : this.store.state;
    const values = Array.isArray(data[this.key]) ? data[this.key] : [];
    this.jobs = new Map(values.map(value => [value.id, new QueueJob(value)]));
    this.requeueExpired();
    return this;
  }

  persist() {
    if (!this.store) return;
    const data = this.store.load ? this.store.load() : this.store.state;
    data[this.key] = [...this.jobs.values()].map(job => job.toJSON());
    if (this.store.save) this.store.save();
  }

  enqueue(input) {
    const job = input instanceof QueueJob ? input : new QueueJob(input);
    if (this.jobs.size >= this.maxSize) throw new Error('Queue capacity exceeded');
    if (this.jobs.has(job.id)) throw new Error(`Job already exists: ${job.id}`);
    this.jobs.set(job.id, job);
    this.persist();
    this.emit('enqueued', job);
    return job;
  }

  get(id) {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Queue job not found: ${id}`);
    return job;
  }

  list(criteria = {}) {
    const values = [...this.jobs.values()].filter(job =>
      (!criteria.status || job.status === criteria.status) &&
      (!criteria.workflowId || job.workflowId === criteria.workflowId) &&
      (!criteria.scheduleId || job.scheduleId === criteria.scheduleId));
    return values.sort((a, b) => b.priority - a.priority || Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }

  claim(worker, now = Date.now()) {
    this.requeueExpired(now);
    const job = this.list().find(value =>
      (value.status === 'queued' || value.status === 'retrying') &&
      Date.parse(value.availableAt) <= now);
    if (!job || !job.lock(worker, this.lockTtlMs)) return null;
    this.persist();
    this.emit('claimed', job);
    return job;
  }

  ack(id, result) {
    const job = this.get(id);
    job.complete(result);
    this.persist();
    this.emit('completed', job);
    return job;
  }

  nack(id, error, retryDelayMs = 1000) {
    const job = this.get(id);
    job.fail(error, retryDelayMs);
    this.persist();
    this.emit(job.status === 'failed' ? 'failed' : 'retrying', job);
    return job;
  }

  cancel(id, reason = 'cancelled by operator') {
    const job = this.get(id);
    if (['completed', 'failed', 'cancelled'].includes(job.status)) return job;
    job.status = 'cancelled';
    job.error = { name: 'CancelledError', message: reason };
    job.finishedAt = new Date().toISOString();
    job.history.push({ event: 'cancelled', reason, at: job.finishedAt });
    this.persist();
    this.emit('cancelled', job);
    return job;
  }

  requeueExpired(now = Date.now()) {
    for (const job of this.jobs.values()) {
      if (job.status === 'running' && job.isExpired(now)) {
        job.status = 'retrying';
        job.lockedBy = null;
        job.lockedUntil = null;
        job.availableAt = new Date(now).toISOString();
        job.history.push({ event: 'lease-expired', at: new Date(now).toISOString() });
      }
    }
    return this;
  }

  purge(options = {}) {
    const olderThan = options.olderThan ? Date.parse(options.olderThan) : Date.now() - 86400000;
    const statuses = new Set(options.statuses || ['completed', 'failed', 'cancelled']);
    let removed = 0;
    for (const [id, job] of this.jobs) {
      if (statuses.has(job.status) && Date.parse(job.finishedAt || job.createdAt) < olderThan) {
        this.jobs.delete(id);
        removed += 1;
      }
    }
    if (removed) this.persist();
    return removed;
  }

  stats() {
    const counts = {};
    for (const job of this.jobs.values()) counts[job.status] = (counts[job.status] || 0) + 1;
    return { total: this.jobs.size, byStatus: counts, active: (counts.running || 0) + (counts.queued || 0) + (counts.retrying || 0) };
  }
}

class QueueWorker {
  constructor(queue, handler, options = {}) {
    this.queue = queue;
    this.handler = handler;
    this.workerId = options.workerId || queueId('worker');
    this.pollMs = options.pollMs || 100;
    this.concurrency = Math.max(1, options.concurrency || 1);
    this.running = 0;
    this.stopped = true;
    this.logger = options.logger || { info() {}, error() {} };
  }

  async process(job) {
    this.running += 1;
    try {
      const result = await this.handler(job);
      this.queue.ack(job.id, result);
    } catch (error) {
      const delay = Math.min(60000, 250 * 2 ** Math.max(0, job.attempts - 1));
      this.queue.nack(job.id, error, delay);
      this.logger.error('Queue job failed', { jobId: job.id, message: error.message });
    } finally {
      this.running -= 1;
    }
  }

  async tick() {
    while (this.running < this.concurrency) {
      const job = this.queue.claim(this.workerId);
      if (!job) break;
      void this.process(job);
    }
    return this.queue.stats();
  }

  start() {
    if (!this.stopped) return this;
    this.stopped = false;
    const loop = async () => {
      if (this.stopped) return;
      await this.tick();
      this.timer = setTimeout(loop, this.pollMs);
      this.timer.unref?.();
    };
    void loop();
    return this;
  }

  async drain(timeoutMs = 30000) {
    const started = Date.now();
    while (this.running || this.queue.stats().active) {
      await this.tick();
      if (Date.now() - started > timeoutMs) throw new Error('Queue drain timed out');
      await new Promise(resolve => setTimeout(resolve, this.pollMs));
    }
    return this.queue.stats();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    return this;
  }
}

module.exports = { QueueJob, PersistentQueue, QueueWorker };
