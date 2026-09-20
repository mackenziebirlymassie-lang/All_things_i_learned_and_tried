'use strict';

class PolicyRule {
  constructor(input = {}) { if (!input.name || typeof input.check !== 'function') throw new TypeError('Policy rule requires name and check'); this.name = input.name; this.check = input.check; this.severity = input.severity || 'error'; this.message = input.message || `${input.name} failed`; this.tags = input.tags || []; }
  async evaluate(context) { try { const passed = await this.check(context); return { name: this.name, passed: Boolean(passed), severity: this.severity, message: passed ? null : this.message, tags: this.tags }; } catch (error) { return { name: this.name, passed: false, severity: this.severity, message: error.message || this.message, tags: this.tags, exception: true }; } }
}

class PolicySet {
  constructor(options = {}) { this.name = options.name || 'policy'; this.rules = []; this.mode = options.mode || 'all'; this.metadata = options.metadata || {}; }
  add(rule, options) { this.rules.push(rule instanceof PolicyRule ? rule : new PolicyRule({ ...options, ...rule })); return this; }
  remove(name) { this.rules = this.rules.filter(rule => rule.name !== name); return this; }
  async evaluate(context = {}) {
    const results = [];
    for (const rule of this.rules) {
      const result = await rule.evaluate(context); results.push(result);
      if (this.mode === 'first-failure' && !result.passed) break;
    }
    const errors = results.filter(result => !result.passed && result.severity === 'error');
    const warnings = results.filter(result => !result.passed && result.severity === 'warning');
    return { name: this.name, passed: errors.length === 0, results, errors, warnings, evaluatedAt: new Date().toISOString() };
  }
}

class PolicyEngine {
  constructor(options = {}) { this.sets = new Map(); this.logger = options.logger || { warn() {} }; }
  register(policy) { if (this.sets.has(policy.name)) throw new Error(`Policy exists: ${policy.name}`); this.sets.set(policy.name, policy); return this; }
  async enforce(names, context = {}, options = {}) {
    const selected = (names ? (Array.isArray(names) ? names : [names]) : [...this.sets.keys()]).map(name => this.sets.get(name)).filter(Boolean);
    const reports = [];
    for (const policy of selected) {
      const report = await policy.evaluate(context); reports.push(report);
      if (!report.passed && options.stopOnFailure) break;
    }
    return { passed: reports.every(report => report.passed), reports, failures: reports.flatMap(report => report.errors) };
  }
  list() { return [...this.sets.values()].map(set => ({ name: set.name, rules: set.rules.length, mode: set.mode })); }
}

function standardPolicies() {
  const safety = new PolicySet({ name: 'task-safety' });
  safety.add({ name: 'title', check: context => Boolean(context.task?.title?.trim()), message: 'Task title is required' });
  safety.add({ name: 'timeout', check: context => !context.task?.timeoutMs || context.task.timeoutMs <= 3600000, message: 'Task timeout exceeds one hour', severity: 'warning' });
  safety.add({ name: 'handler', check: context => Boolean(context.task?.metadata?.handler), message: 'Task handler is not configured' });
  const workflow = new PolicySet({ name: 'workflow-safety' });
  workflow.add({ name: 'tasks', check: context => Array.isArray(context.workflow?.taskIds) && context.workflow.taskIds.length > 0, message: 'Workflow must contain tasks' });
  workflow.add({ name: 'concurrency', check: context => Number(context.workflow?.concurrency) <= 50, message: 'Workflow concurrency is too high' });
  return { safety, workflow };
}

module.exports = { PolicyRule, PolicySet, PolicyEngine, standardPolicies };
