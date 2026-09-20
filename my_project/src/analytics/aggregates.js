'use strict';

class Aggregator {
  constructor(options = {}) { this.fields = options.fields || []; this.rows = []; }
  add(row) { this.rows.push(row); return this; }
  addMany(rows) { for (const row of rows) this.add(row); return this; }
  count() { return this.rows.length; }
  sum(field) { return this.rows.reduce((total, row) => total + (Number(row[field]) || 0), 0); }
  min(field) { return this.rows.reduce((value, row) => value === null || row[field] < value ? row[field] : value, null); }
  max(field) { return this.rows.reduce((value, row) => value === null || row[field] > value ? row[field] : value, null); }
  average(field) { return this.rows.length ? this.sum(field) / this.rows.length : 0; }
  distinct(field) { return [...new Set(this.rows.map(row => row[field]))]; }
  group(field) { const result = new Map(); for (const row of this.rows) { const key = row[field]; if (!result.has(key)) result.set(key, new Aggregator()); result.get(key).add(row); } return result; }
  describe(field) { const values = this.rows.map(row => Number(row[field])).filter(Number.isFinite).sort((a, b) => a - b); const percentile = ratio => values.length ? values[Math.min(values.length - 1, Math.floor(values.length * ratio))] : null; return { count: values.length, sum: values.reduce((a, b) => a + b, 0), min: values[0] ?? null, max: values.at(-1) ?? null, average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0, p50: percentile(.5), p95: percentile(.95), p99: percentile(.99) }; }
  rollup(groupField, metricField) { return Object.fromEntries([...this.group(groupField)].map(([key, aggregate]) => [key, aggregate.describe(metricField)])); }
}

class TimeSeries {
  constructor(options = {}) { this.bucketMs = options.bucketMs || 86400000; this.points = new Map(); }
  add(timestamp, value, dimensions = {}) { const time = new Date(timestamp).getTime(); const bucket = Math.floor(time / this.bucketMs) * this.bucketMs; const key = `${bucket}:${JSON.stringify(dimensions)}`; const point = this.points.get(key) || { bucket, dimensions, values: [] }; point.values.push(Number(value)); this.points.set(key, point); return this; }
  values() { return [...this.points.values()].sort((a, b) => a.bucket - b.bucket).map(point => ({ ...point, count: point.values.length, sum: point.values.reduce((a, b) => a + b, 0), average: point.values.reduce((a, b) => a + b, 0) / point.values.length })); }
  fill(start, end, dimensions = {}, value = 0) { for (let cursor = new Date(start).getTime(); cursor <= new Date(end).getTime(); cursor += this.bucketMs) this.add(cursor, value, dimensions); return this; }
  movingAverage(window = 3) { const values = this.values(); return values.map((point, index) => ({ ...point, movingAverage: values.slice(Math.max(0, index - window + 1), index + 1).reduce((sum, item) => sum + item.average, 0) / Math.min(window, index + 1) })); }
}

module.exports = { Aggregator, TimeSeries };
