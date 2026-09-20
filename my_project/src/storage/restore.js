'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { IntegrityManifest, StateValidator } = require('./integrity');

class RestorePlan {
  constructor(input = {}) { this.source = input.source; this.destination = input.destination; this.overwrite = input.overwrite === true; this.dryRun = input.dryRun === true; this.operations = []; this.warnings = []; }
  add(operation) { this.operations.push(operation); return this; }
  summary() { return { source: this.source, destination: this.destination, overwrite: this.overwrite, dryRun: this.dryRun, operations: this.operations.length, warnings: this.warnings.length }; }
}

class StateRestore {
  constructor(options = {}) { this.fs = options.fs || fs; this.validator = options.validator || new StateValidator(options); this.backups = options.backups || null; }
  inspect(source) {
    const data = JSON.parse(this.fs.readFileSync(source, 'utf8'));
    const state = data.state || data;
    const validation = this.validator.validate(state);
    const manifest = data.manifest ? new IntegrityManifest(data.manifest) : null;
    const integrity = manifest ? manifest.verify('state', state) : { ok: true, reason: 'not-signed' };
    return { state, validation, integrity, metadata: data.metadata || {} };
  }
  plan(source, destination, options = {}) {
    const plan = new RestorePlan({ source, destination, ...options });
    const inspected = this.inspect(source);
    if (!inspected.validation.valid) plan.warnings.push(...inspected.validation.errors);
    if (!inspected.integrity.ok) plan.warnings.push('integrity verification failed');
    if (this.fs.existsSync(destination) && !plan.overwrite) plan.warnings.push('destination exists and overwrite is disabled');
    plan.add({ type: 'write', source, destination, bytes: this.fs.statSync(source).size });
    return plan;
  }
  execute(plan) {
    if (plan.warnings.length && !plan.overwrite) throw new Error(`Restore blocked: ${plan.warnings.join('; ')}`);
    if (plan.dryRun) return plan.summary();
    const inspected = this.inspect(plan.source);
    this.validator.assert(inspected.state);
    this.fs.mkdirSync(path.dirname(plan.destination), { recursive: true });
    const temporary = `${plan.destination}.${process.pid}.restore`;
    this.fs.copyFileSync(plan.source, temporary);
    this.fs.renameSync(temporary, plan.destination);
    return { ...plan.summary(), restored: true, validation: inspected.validation };
  }
  restore(source, destination, options = {}) { return this.execute(this.plan(source, destination, options)); }
}

module.exports = { RestorePlan, StateRestore };
