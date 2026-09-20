'use strict';

const crypto = require('node:crypto');

class Span {
  constructor(tracer, name, parent = null, attributes = {}) { this.tracer = tracer; this.name = name; this.parentId = parent ? parent.id : null; this.id = crypto.randomBytes(8).toString('hex'); this.traceId = parent ? parent.traceId : crypto.randomBytes(16).toString('hex'); this.attributes = { ...attributes }; this.startTime = Date.now(); this.endTime = null; this.status = 'unset'; this.events = []; }
  setAttribute(key, value) { this.attributes[key] = value; return this; }
  addEvent(name, attributes = {}) { this.events.push({ name, attributes, timestamp: Date.now() }); return this; }
  end(status = 'ok') { if (!this.endTime) { this.endTime = Date.now(); this.status = status; this.tracer.record(this); } return this; }
  toJSON() { return { ...this, durationMs: (this.endTime || Date.now()) - this.startTime }; }
}

class Tracer {
  constructor(options = {}) { this.maxSpans = options.maxSpans || 10000; this.spans = []; this.listeners = new Set(); }
  startSpan(name, options = {}) { return new Span(this, name, options.parent, options.attributes); }
  record(span) { this.spans.push(span.toJSON()); if (this.spans.length > this.maxSpans) this.spans.shift(); for (const listener of this.listeners) listener(span); }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  find(traceId) { return this.spans.filter(span => span.traceId === traceId); }
  summary() { const durations = this.spans.map(span => span.durationMs); return { spans: this.spans.length, errors: this.spans.filter(span => span.status === 'error').length, averageMs: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0 }; }
}

async function traced(tracer, name, operation, options = {}) { const span = tracer.startSpan(name, options); try { const value = await operation(span); span.end('ok'); return value; } catch (error) { span.setAttribute('error.message', error.message).end('error'); throw error; } }

module.exports = { Tracer, Span, traced };
