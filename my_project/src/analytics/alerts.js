'use strict';

const { EventEmitter } = require('node:events');
const { compilePredicate } = require('./dsl');

class AlertRule {
  constructor(input = {}) { if (!input.name || !input.condition) throw new TypeError('Alert name and condition are required'); this.name = input.name; this.condition = compilePredicate(input.condition); this.message = input.message || input.name; this.cooldownMs = input.cooldownMs || 300000; this.severity = input.severity || 'warning'; this.channels = input.channels || []; this.lastTriggeredAt = null; this.enabled = input.enabled !== false; }
  shouldTrigger(value, now = Date.now()) { return this.enabled && this.condition(value) && (!this.lastTriggeredAt || now - this.lastTriggeredAt >= this.cooldownMs); }
  trigger(value, now = Date.now()) { this.lastTriggeredAt = now; return { rule: this.name, message: this.message, severity: this.severity, channels: this.channels, value, at: new Date(now).toISOString() }; }
}

class AlertManager extends EventEmitter {
  constructor(options = {}) { super(); this.rules = new Map(); this.history = []; this.maxHistory = options.maxHistory || 1000; this.notifiers = new Map(); }
  add(rule) { const value = rule instanceof AlertRule ? rule : new AlertRule(rule); this.rules.set(value.name, value); return value; }
  remove(name) { return this.rules.delete(name); }
  notify(channel, handler) { this.notifiers.set(channel, handler); return this; }
  evaluate(value, now = Date.now()) {
    const alerts = [];
    for (const rule of this.rules.values()) if (rule.shouldTrigger(value, now)) {
      const alert = rule.trigger(value, now); this.history.push(alert); if (this.history.length > this.maxHistory) this.history.shift(); alerts.push(alert); this.emit('alert', alert);
      for (const channel of alert.channels) if (this.notifiers.has(channel)) Promise.resolve(this.notifiers.get(channel)(alert)).catch(error => this.emit('notification-error', { alert, error }));
    }
    return alerts;
  }
  silence(name) { const rule = this.rules.get(name); if (rule) rule.enabled = false; return this; }
  unsilence(name) { const rule = this.rules.get(name); if (rule) rule.enabled = true; return this; }
  active() { return [...this.rules.values()].filter(rule => rule.enabled).map(rule => rule.name); }
  summary() { return { rules: this.rules.size, active: this.active().length, triggered: this.history.length, latest: this.history.at(-1) || null }; }
}

module.exports = { AlertRule, AlertManager };
