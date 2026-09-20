'use strict';

const { table, color, progress, spinner } = require('./terminal');

function summarizeTasks(tasks) {
  const counts = tasks.reduce((result, task) => { result[task.status] = (result[task.status] || 0) + 1; return result; }, {});
  const total = tasks.length;
  return { total, counts, completed: counts.completed || 0, failed: counts.failed || 0, rate: total ? (counts.completed || 0) / total : 0 };
}

function renderOverview(report, options = {}) {
  const health = report.health || {};
  const tasks = report.tasks || {};
  const rows = [
    { metric: 'Tasks', value: tasks.total ?? health.tasks ?? 0 },
    { metric: 'Completed', value: tasks.byStatus?.completed ?? health.completed ?? 0 },
    { metric: 'Failed', value: tasks.byStatus?.failed ?? health.failed ?? 0 },
    { metric: 'Overdue', value: tasks.overdue ?? health.overdue ?? 0 },
    { metric: 'Workflows', value: report.workflows?.total ?? health.workflows ?? 0 },
    { metric: 'Events', value: report.events ?? health.events ?? 0 }
  ];
  return table(rows, [{ key: 'metric', label: 'Metric', width: 16 }, { key: 'value', label: 'Value', width: 12 }], options);
}

function renderTaskBoard(tasks, options = {}) {
  const groups = new Map();
  for (const task of tasks) { if (!groups.has(task.status)) groups.set(task.status, []); groups.get(task.status).push(task); }
  const lines = [];
  for (const [status, values] of groups) {
    lines.push(color(`${status.toUpperCase()} (${values.length})`, status === 'failed' ? 'red' : status === 'completed' ? 'green' : 'cyan', options.color));
    for (const task of values.slice(0, options.limit || 20)) lines.push(`  ${task.priority.padEnd(8)} ${task.id} ${task.title}`);
  }
  return lines.join('\n');
}

function renderRun(run, options = {}) {
  const total = (run.completed || []).length + (run.failed || []).length + (run.skipped || []).length;
  const completed = (run.completed || []).length;
  return [
    `Workflow ${run.workflowId || 'unknown'}`,
    progress(completed, total),
    `Duration: ${run.durationMs || 0}ms`,
    `Completed: ${completed}  Failed: ${(run.failed || []).length}  Skipped: ${(run.skipped || []).length}`
  ].join('\n');
}

function renderLiveFrame(state, frame = 0, options = {}) {
  const title = color(`${spinner(frame)} FlowForge live dashboard`, 'bold', options.color);
  return `${title}\n\n${renderOverview(state.report || {}, options)}\n\n${renderTaskBoard(state.tasks || [], options)}`;
}

class DashboardSession {
  constructor(options = {}) { this.load = options.load || (() => ({})); this.write = options.write || (value => process.stdout.write(value)); this.intervalMs = options.intervalMs || 1000; this.color = options.color; this.frame = 0; }
  render() { return renderLiveFrame(this.load(), this.frame++, { color: this.color }); }
  start() { if (this.timer) return this; const tick = () => { this.write(`\x1b[2J\x1b[H${this.render()}`); this.timer = setTimeout(tick, this.intervalMs); }; tick(); return this; }
  stop() { if (this.timer) clearTimeout(this.timer); this.timer = null; return this; }
}

module.exports = { summarizeTasks, renderOverview, renderTaskBoard, renderRun, renderLiveFrame, DashboardSession };
