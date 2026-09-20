'use strict';

class Counter {
  constructor(name, help = '') { this.name = name; this.help = help; this.values = new Map(); }
  key(labels = {}) { return JSON.stringify(Object.keys(labels).sort().map(key => [key, labels[key]])); }
  inc(labels = {}, value = 1) { const key = this.key(labels); this.values.set(key, (this.values.get(key) || 0) + value); return this.get(labels); }
  get(labels = {}) { return this.values.get(this.key(labels)) || 0; }
  collect() { return [...this.values].map(([key, value]) => ({ name: this.name, help: this.help, labels: Object.fromEntries(JSON.parse(key)), value })); }
}

class Histogram {
  constructor(name, buckets = [5, 10, 25, 50, 100, 250, 1000]) { this.name = name; this.buckets = buckets.slice().sort((a, b) => a - b); this.samples = []; }
  observe(value, labels = {}) { this.samples.push({ value: Number(value), labels }); if (this.samples.length > 10000) this.samples.shift(); }
  summarize(labels = {}) {
    const values = this.samples.filter(item => JSON.stringify(item.labels) === JSON.stringify(labels)).map(item => item.value).sort((a, b) => a - b);
    return { count: values.length, sum: values.reduce((a, b) => a + b, 0), buckets: Object.fromEntries(this.buckets.map(bucket => [bucket, values.filter(value => value <= bucket).length])) };
  }
}

class MetricsRegistry {
  constructor() { this.counters = new Map(); this.histograms = new Map(); }
  counter(name, help) { if (!this.counters.has(name)) this.counters.set(name, new Counter(name, help)); return this.counters.get(name); }
  histogram(name, buckets) { if (!this.histograms.has(name)) this.histograms.set(name, new Histogram(name, buckets)); return this.histograms.get(name); }
  collect() { return { counters: [...this.counters.values()].flatMap(metric => metric.collect()), histograms: Object.fromEntries([...this.histograms].map(([name, metric]) => [name, metric.summarize()])) }; }
  prometheus() { return [...this.counters.values()].flatMap(metric => metric.collect().map(row => `${row.name}${labelsText(row.labels)} ${row.value}`)).join('\n'); }
}

function labelsText(labels) { const entries = Object.entries(labels); return entries.length ? `{${entries.map(([key, value]) => `${key}="${String(value).replaceAll('"', '\\"')}"`).join(',')}}` : ''; }

module.exports = { MetricsRegistry, Counter, Histogram };
