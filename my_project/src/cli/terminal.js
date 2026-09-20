'use strict';

const ANSI = Object.freeze({ reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m' });

function color(text, tone, enabled = process.stdout.isTTY) { return enabled ? `${ANSI[tone] || ''}${text}${ANSI.reset}` : String(text); }
function width(value) { return [...String(value)].length; }
function truncate(value, size) { const text = String(value); return width(text) <= size ? text : `${[...text].slice(0, Math.max(0, size - 1)).join('')}…`; }
function table(rows, columns, options = {}) {
  const values = rows.map(row => columns.map(column => truncate(typeof column.value === 'function' ? column.value(row) : row[column.key], column.width || 30)));
  const header = columns.map(column => truncate(column.label || column.key, column.width || 30));
  const widths = header.map((value, index) => Math.max(width(value), ...values.map(row => width(row[index]))));
  const line = row => row.map((value, index) => String(value).padEnd(widths[index])).join(options.separator || '  ');
  return [line(header), widths.map(size => '-'.repeat(size)).join(options.separator || '  '), ...values.map(line)].join('\n');
}
function spinner(frame = 0) { return ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'][frame % 10]; }
function progress(value, total, size = 24) { const ratio = total ? Math.min(1, Math.max(0, value / total)) : 0; const filled = Math.round(ratio * size); return `[${'#'.repeat(filled)}${'-'.repeat(size - filled)}] ${(ratio * 100).toFixed(1)}%`; }
function renderTask(task, options = {}) { const status = task.status === 'completed' ? color(task.status, 'green', options.color) : task.status === 'failed' ? color(task.status, 'red', options.color) : task.status; return `${status} ${task.priority} ${task.id} ${task.title}`; }

module.exports = { ANSI, color, table, spinner, progress, renderTask, truncate };
