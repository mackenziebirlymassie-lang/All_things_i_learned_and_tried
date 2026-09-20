'use strict';

const fs = require('node:fs');

function escapeLabel(value) { return String(value).replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('"', '\\"'); }

class PrometheusExporter {
  constructor(registry, options = {}) { this.registry = registry; this.prefix = options.prefix || 'flowforge'; }
  render() {
    const lines = [];
    for (const metric of this.registry.counters.values()) {
      lines.push(`# HELP ${this.prefix}_${metric.name} ${metric.help || metric.name}`);
      lines.push(`# TYPE ${this.prefix}_${metric.name} counter`);
      for (const row of metric.collect()) lines.push(`${this.prefix}_${metric.name}${this.labels(row.labels)} ${row.value}`);
    }
    for (const [name, metric] of this.registry.histograms) {
      lines.push(`# TYPE ${this.prefix}_${name} histogram`);
      const summary = metric.summarize();
      for (const [bucket, value] of Object.entries(summary.buckets)) lines.push(`${this.prefix}_${name}_bucket{le="${bucket}"} ${value}`);
      lines.push(`${this.prefix}_${name}_sum ${summary.sum}`, `${this.prefix}_${name}_count ${summary.count}`);
    }
    return `${lines.join('\n')}\n`;
  }
  labels(labels = {}) { const values = Object.entries(labels).map(([key, value]) => `${key}="${escapeLabel(value)}"`); return values.length ? `{${values.join(',')}}` : ''; }
  write(file) { fs.writeFileSync(file, this.render()); return file; }
}

class JsonExporter {
  constructor(options = {}) { this.pretty = options.pretty !== false; }
  metrics(registry) { return registry.collect(); }
  traces(tracer, options = {}) { const spans = options.traceId ? tracer.find(options.traceId) : tracer.spans; return { generatedAt: new Date().toISOString(), summary: tracer.summary(), spans }; }
  report(value) { return JSON.stringify(value, null, this.pretty ? 2 : 0); }
  write(file, value) { fs.writeFileSync(file, this.report(value)); return file; }
}

class OpenTelemetryExporter {
  constructor(options = {}) { this.endpoint = options.endpoint || null; this.fetch = options.fetch || globalThis.fetch; this.serviceName = options.serviceName || 'flowforge'; }
  payload(tracer, options = {}) {
    return { resourceSpans: [{ resource: { attributes: [{ key: 'service.name', value: { stringValue: this.serviceName } }] }, scopeSpans: [{ spans: (options.traceId ? tracer.find(options.traceId) : tracer.spans).map(span => ({ traceId: span.traceId, spanId: span.id, name: span.name, startTimeUnixNano: String(span.startTime * 1000000), endTimeUnixNano: String((span.endTime || Date.now()) * 1000000), attributes: Object.entries(span.attributes).map(([key, value]) => ({ key, value: { stringValue: String(value) } })) })) }] }] };
  }
  async send(tracer, options = {}) {
    if (!this.endpoint || typeof this.fetch !== 'function') throw new Error('OTLP endpoint and fetch are required');
    const response = await this.fetch(this.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(this.payload(tracer, options)) });
    if (!response.ok) throw new Error(`OTLP export failed: ${response.status}`);
    return response;
  }
}

class EventExporter {
  constructor(eventBus, options = {}) { this.file = options.file || null; this.writer = options.writer || (line => this.file && fs.appendFileSync(this.file, `${line}\n`)); this.unsubscribe = []; this.eventBus = eventBus; }
  start(types = ['*']) {
    for (const type of types) {
      const listener = event => this.writer(JSON.stringify({ exportedAt: new Date().toISOString(), event }));
      this.eventBus.on(type, listener);
      this.unsubscribe.push(() => this.eventBus.off(type, listener));
    }
    return this;
  }
  stop() { for (const remove of this.unsubscribe) remove(); this.unsubscribe = []; return this; }
}

module.exports = { PrometheusExporter, JsonExporter, OpenTelemetryExporter, EventExporter };
