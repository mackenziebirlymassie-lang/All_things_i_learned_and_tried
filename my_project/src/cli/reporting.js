'use strict';
const { Reporter } = require('../core/engine');
function renderTable(rows) { if (!rows.length) return '(no results)'; const keys = Object.keys(rows[0]); const widths = keys.map(k => Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length))); const line = values => values.map((v, i) => String(v ?? '').padEnd(widths[i])).join(' | '); return [line(keys), widths.map(w => '-'.repeat(w)).join('-+-'), ...rows.map(r => line(keys.map(k => r[k])))].join('\n'); }
module.exports = { Reporter, renderTable };
