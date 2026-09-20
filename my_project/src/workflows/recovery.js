'use strict';

class Compensation {
  constructor(input = {}) {
    if (!input.name || typeof input.run !== 'function') throw new TypeError('Compensation requires name and run');
    this.name = input.name;
    this.run = input.run;
    this.when = input.when || (() => true);
  }
}

class RecoveryPlan {
  constructor(options = {}) {
    this.name = options.name || 'recovery';
    this.compensations = [];
    this.logger = options.logger || { warn() {}, error() {} };
  }

  add(compensation, options) {
    this.compensations.push(compensation instanceof Compensation ? compensation : new Compensation({ ...options, ...compensation }));
    return this;
  }

  async execute(context, options = {}) {
    const results = [];
    const selected = [...this.compensations].reverse();
    for (const compensation of selected) {
      if (!await compensation.when(context)) {
        results.push({ name: compensation.name, status: 'skipped' });
        continue;
      }
      try {
        const value = await compensation.run(context);
        results.push({ name: compensation.name, status: 'completed', value });
      } catch (error) {
        const result = { name: compensation.name, status: 'failed', error: { message: error.message, code: error.code || null } };
        results.push(result);
        this.logger.error('compensation failed', result);
        if (options.stopOnFailure) break;
      }
    }
    return { name: this.name, status: results.some(result => result.status === 'failed') ? 'failed' : 'completed', results };
  }
}

class Saga {
  constructor(options = {}) {
    this.name = options.name || 'saga';
    this.steps = [];
    this.logger = options.logger;
  }

  step(name, action, compensate, options = {}) {
    this.steps.push({ name, action, compensate, optional: options.optional === true });
    return this;
  }

  async run(context = {}) {
    const completed = [];
    const results = [];
    try {
      for (const step of this.steps) {
        try {
          const value = await step.action(context);
          completed.push(step);
          results.push({ name: step.name, status: 'completed', value });
        } catch (error) {
          results.push({ name: step.name, status: 'failed', error: { message: error.message } });
          if (!step.optional) throw error;
        }
      }
      return { name: this.name, status: 'completed', results, compensations: [] };
    } catch (error) {
      const compensations = [];
      for (const step of completed.reverse()) {
        if (typeof step.compensate !== 'function') continue;
        try { compensations.push({ name: step.name, status: 'completed', value: await step.compensate(context) }); }
        catch (cause) { compensations.push({ name: step.name, status: 'failed', error: { message: cause.message } }); }
      }
      return { name: this.name, status: 'compensated', results, compensations, error: { message: error.message } };
    }
  }
}

module.exports = { Compensation, RecoveryPlan, Saga };
