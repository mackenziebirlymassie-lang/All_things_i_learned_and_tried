'use strict';
class WorkerPool {
  constructor(concurrency = 3) { this.concurrency = Math.max(1, Number(concurrency) || 1); this.active = 0; this.queue = []; }
  run(task) { return new Promise((resolve, reject) => { this.queue.push({ task, resolve, reject }); this.drain(); }); }
  drain() { while (this.active < this.concurrency && this.queue.length) { const job = this.queue.shift(); this.active++; Promise.resolve().then(job.task).then(job.resolve, job.reject).finally(() => { this.active--; this.drain(); }); } }
  get pending() { return this.queue.length; }
}
module.exports = { WorkerPool };
