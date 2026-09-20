'use strict';

class Sampler {
  constructor(options = {}) { this.rate = Math.max(0, Math.min(1, options.rate === undefined ? 1 : options.rate)); this.always = new Set(options.always || []); this.never = new Set(options.never || []); }
  decide(name, value = Math.random()) { if (this.always.has(name)) return true; if (this.never.has(name)) return false; return value < this.rate; }
}

class TailSampler {
  constructor(options = {}) { this.limit = options.limit || 1000; this.errorRate = options.errorRate === undefined ? 1 : options.errorRate; this.latencyMs = options.latencyMs || 1000; this.spans = new Map(); }
  add(span) { const list = this.spans.get(span.traceId) || []; list.push(span); this.spans.set(span.traceId, list); if (this.spans.size > this.limit) this.spans.delete(this.spans.keys().next().value); }
  shouldKeep(traceId) { const spans = this.spans.get(traceId) || []; return spans.some(span => span.status === 'error') || spans.some(span => span.durationMs >= this.latencyMs) || Math.random() < this.errorRate; }
  flush() { const result = []; for (const [traceId, spans] of this.spans) if (this.shouldKeep(traceId)) result.push(...spans); this.spans.clear(); return result; }
}

class RateLimiter {
  constructor(options = {}) { this.limit = options.limit || 100; this.windowMs = options.windowMs || 60000; this.events = []; }
  allow(now = Date.now()) { this.events = this.events.filter(timestamp => timestamp > now - this.windowMs); if (this.events.length >= this.limit) return false; this.events.push(now); return true; }
  remaining(now = Date.now()) { this.events = this.events.filter(timestamp => timestamp > now - this.windowMs); return Math.max(0, this.limit - this.events.length); }
  reset() { this.events = []; return this; }
}

module.exports = { Sampler, TailSampler, RateLimiter };
