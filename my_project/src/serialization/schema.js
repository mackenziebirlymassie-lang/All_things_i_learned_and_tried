'use strict';

class SchemaError extends Error {
  constructor(path, message, value) { super(`${path || '$'}: ${message}`); this.name = 'SchemaError'; this.path = path; this.value = value; }
}

function typeOf(value) { if (value === null) return 'null'; if (Array.isArray(value)) return 'array'; return typeof value; }

class Schema {
  constructor(definition = {}, options = {}) { this.definition = definition; this.name = options.name || 'schema'; this.coerce = options.coerce === true; this.stripUnknown = options.stripUnknown === true; }
  validate(value, path = '$') {
    const errors = [];
    const result = this._validate(value, this.definition, path, errors);
    return { valid: errors.length === 0, value: result, errors };
  }
  assert(value) { const result = this.validate(value); if (!result.valid) throw result.errors[0]; return result.value; }
  _validate(value, definition, path, errors) {
    if (definition === true) return value;
    if (definition === false) { errors.push(new SchemaError(path, 'value is not allowed', value)); return value; }
    if (typeof definition === 'function') { try { const result = definition(value); if (result === false) throw new Error('custom validation failed'); return result === true ? value : result; } catch (error) { errors.push(new SchemaError(path, error.message, value)); return value; } }
    if (definition.enum && !definition.enum.includes(value)) errors.push(new SchemaError(path, `must be one of ${definition.enum.join(', ')}`, value));
    if (definition.type && typeOf(value) !== definition.type) {
      if (this.coerce && definition.type === 'number' && value !== '' && Number.isFinite(Number(value))) value = Number(value);
      else if (this.coerce && definition.type === 'boolean' && (value === 'true' || value === 'false')) value = value === 'true';
      else { errors.push(new SchemaError(path, `must be ${definition.type}`, value)); return value; }
    }
    if (definition.required && (value === undefined || value === null || value === '')) errors.push(new SchemaError(path, 'is required', value));
    if (value == null) return value;
    if (definition.type === 'string') { if (definition.minLength && value.length < definition.minLength) errors.push(new SchemaError(path, 'is too short', value)); if (definition.maxLength && value.length > definition.maxLength) errors.push(new SchemaError(path, 'is too long', value)); if (definition.pattern && !definition.pattern.test(value)) errors.push(new SchemaError(path, 'has invalid format', value)); }
    if (definition.type === 'number') { if (definition.min !== undefined && value < definition.min) errors.push(new SchemaError(path, 'is below minimum', value)); if (definition.max !== undefined && value > definition.max) errors.push(new SchemaError(path, 'is above maximum', value)); }
    if (definition.type === 'array') { if (definition.minItems && value.length < definition.minItems) errors.push(new SchemaError(path, 'has too few items', value)); if (definition.maxItems && value.length > definition.maxItems) errors.push(new SchemaError(path, 'has too many items', value)); if (definition.items) value = value.map((item, index) => this._validate(item, definition.items, `${path}[${index}]`, errors)); }
    if (definition.type === 'object') {
      const output = {};
      for (const [key, child] of Object.entries(definition.properties || {})) { const childValue = this._validate(value[key], child, `${path}.${key}`, errors); if (childValue !== undefined) output[key] = childValue; }
      for (const key of Object.keys(value)) if (!definition.properties?.[key] && !this.stripUnknown) output[key] = value[key];
      value = output;
    }
    return value;
  }
}

const taskSchema = new Schema({ type: 'object', properties: { id: { type: 'string' }, title: { type: 'string', required: true, minLength: 1, maxLength: 240 }, status: { type: 'string', enum: ['backlog', 'ready', 'blocked', 'running', 'completed', 'failed', 'cancelled'] }, priority: { type: 'string', enum: ['low', 'normal', 'high', 'critical'] }, tags: { type: 'array', items: { type: 'string' } }, timeoutMs: { type: 'number', min: 1 } } }, { name: 'task', stripUnknown: false, coerce: true });
const workflowSchema = new Schema({ type: 'object', properties: { id: { type: 'string' }, name: { type: 'string', required: true }, taskIds: { type: 'array', items: { type: 'string' } }, concurrency: { type: 'number', min: 1, max: 100 } } }, { name: 'workflow', coerce: true });

function validateTask(value) { return taskSchema.validate(value); }
function validateWorkflow(value) { return workflowSchema.validate(value); }
function assertTask(value) { return taskSchema.assert(value); }
function assertWorkflow(value) { return workflowSchema.assert(value); }

module.exports = { Schema, SchemaError, validateTask, validateWorkflow, assertTask, assertWorkflow, taskSchema, workflowSchema };
