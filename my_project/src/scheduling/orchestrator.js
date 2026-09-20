'use strict';

const { Schedule, intervalExpression } = require('./cron');

class ScheduleStore {
  constructor(repository) {
    this.repository = repository;
    this.entries = new Map();
  }

  add(input) {
    if (!input || !input.workflowId) throw new TypeError('workflowId is required');
    const expression = intervalExpression(input.expression || input.interval || '* * * * *');
    const schedule = { id: input.id || `schedule_${Date.now()}_${Math.random().toString(16).slice(2)}`, workflowId: input.workflowId, expression, enabled: input.enabled !== false, nextRunAt: null, lastRunAt: null, runCount: 0, metadata: input.metadata || {} };
    schedule.parser = new Schedule(expression, input);
    schedule.nextRunAt = schedule.parser.next(new Date()).toISOString();
    this.entries.set(schedule.id, schedule);
    return this.public(schedule);
  }

  public(value) {
    const copy = { ...value };
    delete copy.parser;
    return copy;
  }

  get(id) {
    const value = this.entries.get(id);
    if (!value) throw new Error(`Schedule not found: ${id}`);
    return value;
  }

  remove(id) { return this.entries.delete(id); }
  enable(id) { this.get(id).enabled = true; return this.public(this.get(id)); }
  disable(id) { this.get(id).enabled = false; return this.public(this.get(id)); }
  list() { return [...this.entries.values()].map(value => this.public(value)); }
}

class Scheduler {
  constructor(options = {}) {
    this.runner = options.runner;
    this.store = options.store || new ScheduleStore(options.repository);
    this.clock = options.clock || (() => new Date());
    this.logger = options.logger || { info() {}, warn() {} };
    this.running = new Set();
    this.dependencies = new Map();
  }

  add(input) { return this.store.add(input); }

  dependsOn(scheduleId, dependencyId) {
    if (scheduleId === dependencyId) throw new Error('A schedule cannot depend on itself');
    const dependencies = this.dependencies.get(scheduleId) || new Set();
    dependencies.add(dependencyId);
    this.dependencies.set(scheduleId, dependencies);
    return this.dependenciesOf(scheduleId);
  }

  dependenciesOf(id) { return [...(this.dependencies.get(id) || [])]; }

  canRun(id) {
    return this.dependenciesOf(id).every(dependencyId => {
      const dependency = this.store.get(dependencyId);
      return dependency.lastRunAt && (!dependency.nextRunAt || dependency.lastRunAt >= dependency.nextRunAt);
    });
  }

  due(at = this.clock()) {
    const timestamp = at.getTime();
    return this.store.list().filter(item => item.enabled && item.nextRunAt && Date.parse(item.nextRunAt) <= timestamp && this.canRun(item.id));
  }

  async tick(at = this.clock()) {
    const results = [];
    for (const item of this.due(at)) {
      if (this.running.has(item.id)) continue;
      const state = this.store.get(item.id);
      this.running.add(item.id);
      try {
        const result = await this.runner.run(state.workflowId, { actor: 'scheduler', scheduleId: state.id });
        state.lastRunAt = at.toISOString();
        state.runCount += 1;
        const next = state.parser.next(at);
        state.nextRunAt = next ? next.toISOString() : null;
        results.push({ scheduleId: state.id, workflowId: state.workflowId, result });
      } catch (error) {
        this.logger.warn('Scheduled workflow failed', { scheduleId: state.id, message: error.message });
        state.lastRunAt = at.toISOString();
        state.nextRunAt = state.parser.next(at)?.toISOString() || null;
        results.push({ scheduleId: state.id, workflowId: state.workflowId, error });
      } finally {
        this.running.delete(item.id);
      }
    }
    return results;
  }

  start(intervalMs = 30000) {
    if (this.timer) return this.timer;
    this.timer = setInterval(() => this.tick().catch(error => this.logger.warn('Scheduler tick failed', { message: error.message })), intervalMs);
    this.timer.unref?.();
    return this.timer;
  }

  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}

module.exports = { Scheduler, ScheduleStore };
