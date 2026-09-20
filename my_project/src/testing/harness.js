'use strict';

const assert = require('node:assert/strict');

class TestClock {
  constructor(start = Date.now()) { this.current = new Date(start).getTime(); this.timers = []; }
  now() { return new Date(this.current); }
  advance(milliseconds) { this.current += milliseconds; this.flush(); return this.now(); }
  set(value) { this.current = new Date(value).getTime(); this.flush(); return this.now(); }
  timeout(callback, milliseconds) { const timer = { at: this.current + milliseconds, callback, cancelled: false }; this.timers.push(timer); return { cancel: () => { timer.cancelled = true; } }; }
  flush() { this.timers.sort((a, b) => a.at - b.at); while (this.timers[0] && this.timers[0].at <= this.current) { const timer = this.timers.shift(); if (!timer.cancelled) timer.callback(); } }
}

class FakeStore {
  constructor(initial = {}) { this.state = structuredClone(initial); this.saves = 0; }
  load() { return this.state; }
  save() { this.saves += 1; return this.state; }
  reset(value = {}) { this.state = structuredClone(value); this.saves = 0; return this; }
}

class FakeLogger {
  constructor() { this.entries = []; }
  write(level, message, context) { this.entries.push({ level, message, context }); }
  debug(message, context) { return this.write('debug', message, context); }
  info(message, context) { return this.write('info', message, context); }
  warn(message, context) { return this.write('warn', message, context); }
  error(message, context) { return this.write('error', message, context); }
  byLevel(level) { return this.entries.filter(entry => entry.level === level); }
}

class FakeRunner {
  constructor(handler = async workflowId => ({ workflowId, completed: [] })) { this.handler = handler; this.runs = []; }
  async run(id, options = {}) { this.runs.push({ id, options }); return this.handler(id, options); }
}

class FakeHttp {
  constructor() { this.requests = []; this.routes = new Map(); }
  respond(method, url, response) { this.routes.set(`${method.toUpperCase()} ${url}`, response); return this; }
  async fetch(url, options = {}) { const key = `${(options.method || 'GET').toUpperCase()} ${url}`; this.requests.push({ url, options }); const response = this.routes.get(key) || { status: 404, body: '' }; return { status: response.status || 200, ok: response.status >= 200 && response.status < 300, headers: response.headers || {}, text: async () => response.body || '', json: async () => JSON.parse(response.body || '{}') }; }
}

function property(name, values, check) { return { name, values, run() { for (const value of values) check(value); return { name, cases: values.length }; } }; }
function assertEventually(check, options = {}) { const timeout = options.timeout || 1000; const interval = options.interval || 10; const started = Date.now(); return new Promise((resolve, reject) => { const attempt = () => { try { if (check()) return resolve(true); } catch (error) { if (options.ignoreErrors !== true) return reject(error); } if (Date.now() - started >= timeout) return reject(new Error('Condition was not met')); setTimeout(attempt, interval); }; attempt(); }); }
function withTimeout(promise, milliseconds = 1000) { let timer; return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Test timeout')), milliseconds); })]).finally(() => clearTimeout(timer)); }
function captureOutput(operation) { const output = []; const original = console.log; console.log = (...args) => output.push(args.join(' ')); return Promise.resolve().then(operation).then(value => ({ value, output })).finally(() => { console.log = original; }); }
function fakeState(tasks = []) { return { version: 1, savedAt: null, tasks: Object.fromEntries(tasks.map(task => [task.id, task])), workflows: {}, events: [], settings: {} }; }
function assertSubset(actual, expected, path = '$') { for (const [key, value] of Object.entries(expected)) { assert.ok(actual && key in actual, `${path}.${key} is missing`); if (value && typeof value === 'object' && !Array.isArray(value)) assertSubset(actual[key], value, `${path}.${key}`); else assert.deepEqual(actual[key], value); } }
function repeat(count, callback) { const results = []; for (let index = 0; index < count; index += 1) results.push(callback(index)); return results; }

module.exports = { TestClock, FakeStore, FakeLogger, FakeRunner, FakeHttp, property, assertEventually, withTimeout, captureOutput, fakeState, assertSubset, repeat };
