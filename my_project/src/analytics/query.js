'use strict';

function groupBy(items, key) {
  const result = new Map();
  for (const item of items) {
    const value = typeof key === 'function' ? key(item) : item[key];
    if (!result.has(value)) result.set(value, []);
    result.get(value).push(item);
  }
  return result;
}

class AnalyticsQuery {
  constructor(repository) { this.repository = repository; }
  tasks() { return [...this.repository.tasks.values()]; }
  events() { return this.repository.store.state.events || []; }
  countBy(field, items = this.tasks()) {
    return Object.fromEntries([...groupBy(items, field)].map(([key, values]) => [key, values.length]));
  }
  throughput(options = {}) {
    const since = options.since ? Date.parse(options.since) : -Infinity;
    const until = options.until ? Date.parse(options.until) : Infinity;
    const completed = this.tasks().filter(task => task.completedAt && Date.parse(task.completedAt) >= since && Date.parse(task.completedAt) <= until);
    const days = Math.max(1, (until === Infinity ? Date.now() : until) - (since === -Infinity ? Date.now() - 86400000 : since)) / 86400000;
    return { completed: completed.length, perDay: completed.length / days, byPriority: this.countBy('priority', completed), byTag: this.tagCounts(completed) };
  }
  tagCounts(items = this.tasks()) {
    const counts = {};
    for (const task of items) for (const tag of task.tags || []) counts[tag] = (counts[tag] || 0) + 1;
    return counts;
  }
  cycleTime(options = {}) {
    const completed = this.tasks().filter(task => task.startedAt && task.completedAt);
    const values = completed.map(task => Date.parse(task.completedAt) - Date.parse(task.startedAt)).filter(Number.isFinite);
    values.sort((a, b) => a - b);
    const percentile = fraction => values.length ? values[Math.min(values.length - 1, Math.floor(values.length * fraction))] : 0;
    return { samples: values.length, averageMs: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0, medianMs: percentile(.5), p90Ms: percentile(.9), slowest: completed.slice().sort((a, b) => Date.parse(b.completedAt) - Date.parse(b.startedAt) - (Date.parse(a.completedAt) - Date.parse(a.startedAt))).slice(0, options.limit || 10).map(task => task.id) };
  }
  eventTimeline(options = {}) {
    const limit = Math.min(10000, Math.max(1, Number(options.limit) || 100));
    return this.events().filter(event => !options.type || event.type === options.type).slice(-limit).map(event => ({ timestamp: event.timestamp, type: event.type, entityId: event.entityId }));
  }
  health() {
    const tasks = this.tasks();
    const failed = tasks.filter(task => task.status === 'failed').length;
    const overdue = tasks.filter(task => task.isOverdue && task.isOverdue()).length;
    return { ok: failed === 0, tasks: tasks.length, failed, overdue, workflows: this.repository.workflows.size, events: this.events().length };
  }
  report() { return { generatedAt: new Date().toISOString(), health: this.health(), throughput: this.throughput(), cycleTime: this.cycleTime(), statuses: this.countBy('status'), priorities: this.countBy('priority'), tags: this.tagCounts() }; }
}

module.exports = { AnalyticsQuery, groupBy };
