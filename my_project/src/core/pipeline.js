'use strict';

const { EventEmitter } = require('node:events');

class PipelineContext {
  constructor(input = {}) { this.input = input; this.values = new Map(); this.errors = []; this.startedAt = Date.now(); this.signal = input.signal || null; }
  set(key, value) { this.values.set(key, value); return value; }
  get(key, fallback) { return this.values.has(key) ? this.values.get(key) : fallback; }
  has(key) { return this.values.has(key); }
  snapshot() { return { input: this.input, values: Object.fromEntries(this.values), errors: [...this.errors], durationMs: Date.now() - this.startedAt }; }
}

class PipelineStep {
  constructor(input = {}) { if (!input.name || typeof input.run !== 'function') throw new TypeError('Pipeline steps require name and run'); this.name = input.name; this.run = input.run; this.when = input.when || (() => true); this.retry = input.retry || 0; this.timeoutMs = input.timeoutMs || 0; this.continueOnError = input.continueOnError === true; }
}

function withTimeout(promise, milliseconds, label) {
  if (!milliseconds) return promise;
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error(`${label} timed out`), { code: 'PIPELINE_TIMEOUT' })), milliseconds); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

class Pipeline extends EventEmitter {
  constructor(options = {}) { super(); this.name = options.name || 'pipeline'; this.steps = []; this.logger = options.logger || { info() {}, warn() {} }; }
  use(step, options = {}) { this.steps.push(step instanceof PipelineStep ? step : new PipelineStep({ ...options, ...step })); return this; }
  insert(index, step) { this.steps.splice(index, 0, step instanceof PipelineStep ? step : new PipelineStep(step)); return this; }
  remove(name) { this.steps = this.steps.filter(step => step.name !== name); return this; }
  validate() { const names = new Set(); for (const step of this.steps) { if (names.has(step.name)) throw new Error(`Duplicate pipeline step: ${step.name}`); names.add(step.name); } return true; }
  async run(input = {}, options = {}) {
    this.validate();
    const context = new PipelineContext(input);
    const results = [];
    this.emit('started', { name: this.name, context });
    for (const step of this.steps) {
      if (options.signal?.aborted || context.signal?.aborted) throw Object.assign(new Error('Pipeline aborted'), { code: 'PIPELINE_ABORTED' });
      if (!await step.when(context)) { results.push({ name: step.name, status: 'skipped' }); continue; }
      const started = Date.now();
      let attempt = 0; let value;
      try {
        while (true) {
          attempt += 1;
          try { value = await withTimeout(Promise.resolve(step.run(context)), step.timeoutMs, step.name); break; }
          catch (error) { if (attempt > step.retry) throw error; this.logger.warn('pipeline retry', { step: step.name, attempt, message: error.message }); }
        }
        context.set(step.name, value);
        const result = { name: step.name, status: 'completed', attempt, durationMs: Date.now() - started, value };
        results.push(result); this.emit('step.completed', result);
      } catch (error) {
        const result = { name: step.name, status: 'failed', attempt, durationMs: Date.now() - started, error: { message: error.message, code: error.code || null } };
        results.push(result); context.errors.push(result); this.emit('step.failed', result);
        if (!step.continueOnError && !options.continueOnError) { this.emit('failed', { context, results }); error.pipeline = { context: context.snapshot(), results }; throw error; }
      }
    }
    const output = { name: this.name, status: context.errors.length ? 'degraded' : 'completed', results, context: context.snapshot() };
    this.emit('completed', output);
    return output;
  }
}

class PipelineRegistry {
  constructor() { this.pipelines = new Map(); }
  register(name, pipeline) { if (this.pipelines.has(name)) throw new Error(`Pipeline exists: ${name}`); this.pipelines.set(name, pipeline); return pipeline; }
  get(name) { const pipeline = this.pipelines.get(name); if (!pipeline) throw new Error(`Pipeline not found: ${name}`); return pipeline; }
  list() { return [...this.pipelines.keys()]; }
  remove(name) { return this.pipelines.delete(name); }
}

module.exports = { PipelineContext, PipelineStep, Pipeline, PipelineRegistry, withTimeout };
