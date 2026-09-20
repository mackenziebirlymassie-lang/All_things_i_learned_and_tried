'use strict';

class RetryableError extends Error {
  constructor(message, options = {}) { super(message); this.name = 'RetryableError'; this.retryable = options.retryable !== false; this.code = options.code || 'RETRYABLE'; }
}

class Backoff {
  constructor(options = {}) { this.baseMs = options.baseMs || 100; this.factor = options.factor || 2; this.maxMs = options.maxMs || 30000; this.jitter = options.jitter === undefined ? .1 : options.jitter; }
  delay(attempt) {
    const raw = Math.min(this.maxMs, this.baseMs * this.factor ** Math.max(0, attempt - 1));
    const spread = raw * this.jitter;
    return Math.max(0, Math.round(raw - spread + Math.random() * spread * 2));
  }
}

async function retry(operation, options = {}) {
  const attempts = Math.max(1, options.attempts || 3);
  const backoff = options.backoff || new Backoff(options);
  const shouldRetry = options.shouldRetry || (error => error.retryable !== false);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await operation(attempt); } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetry(error, attempt)) throw error;
      if (options.onRetry) await options.onRetry(error, attempt, backoff.delay(attempt));
      await new Promise(resolve => setTimeout(resolve, backoff.delay(attempt)));
    }
  }
  throw lastError;
}

class Bulkhead {
  constructor(limit = 5) { this.limit = Math.max(1, limit); this.active = 0; this.waiting = []; }
  async run(operation) {
    if (this.active >= this.limit) await new Promise((resolve, reject) => this.waiting.push({ resolve, reject }));
    this.active += 1;
    try { return await operation(); } finally {
      this.active -= 1;
      const next = this.waiting.shift();
      if (next) next.resolve();
    }
  }
  stats() { return { limit: this.limit, active: this.active, waiting: this.waiting.length }; }
}

module.exports = { RetryableError, Backoff, retry, Bulkhead };
