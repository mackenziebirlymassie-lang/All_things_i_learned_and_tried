'use strict';

const { spawn } = require('node:child_process');

class ProcessAdapter {
  constructor(options = {}) {
    this.cwd = options.cwd || process.cwd();
    this.env = { ...process.env, ...(options.env || {}) };
    this.allowed = options.allowedCommands ? new Set(options.allowedCommands) : null;
    this.timeoutMs = options.timeoutMs || 30000;
  }

  validate(command) {
    if (!command || typeof command !== 'string') throw new TypeError('Command is required');
    const executable = command.trim().split(/\s+/)[0];
    if (this.allowed && !this.allowed.has(executable)) throw new Error(`Command is not allowed: ${executable}`);
  }

  run(command, args = [], options = {}) {
    this.validate(command);
    const timeoutMs = options.timeoutMs || this.timeoutMs;
    return new Promise((resolve, reject) => {
      const child = spawn(command, args.map(String), { cwd: options.cwd || this.cwd, env: { ...this.env, ...(options.env || {}) }, shell: false, windowsHide: true });
      let stdout = ''; let stderr = ''; let settled = false;
      const finish = (error, result) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(result); };
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', error => finish(error));
      child.on('close', code => finish(null, { code, signal: null, stdout, stderr, ok: code === 0 }));
      const timer = setTimeout(() => { child.kill(); finish(Object.assign(new Error('Process timed out'), { code: 'PROCESS_TIMEOUT', stdout, stderr })); }, timeoutMs);
    });
  }
}

module.exports = { ProcessAdapter };
