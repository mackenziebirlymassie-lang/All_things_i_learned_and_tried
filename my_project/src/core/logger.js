'use strict';
class Logger {
  constructor(level = 'info', output = console) { this.level = level; this.output = output; this.rank = { debug: 0, info: 1, warn: 2, error: 3 }; }
  write(level, message, data) { if (this.rank[level] < this.rank[this.level]) return; const suffix = data === undefined ? '' : ` ${JSON.stringify(data)}`; this.output[level === 'debug' ? 'log' : level](`[${level.toUpperCase()}] ${message}${suffix}`); }
  debug(m,d) { this.write('debug',m,d); } info(m,d) { this.write('info',m,d); } warn(m,d) { this.write('warn',m,d); } error(m,d) { this.write('error',m,d); }
}
module.exports = { Logger };
