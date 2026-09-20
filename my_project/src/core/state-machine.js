'use strict';

const { EventEmitter } = require('node:events');

class Transition {
  constructor(input = {}) { this.from = input.from; this.to = input.to; this.event = input.event; this.guard = input.guard || (() => true); this.action = input.action || (() => undefined); this.description = input.description || ''; }
}

class StateMachine extends EventEmitter {
  constructor(options = {}) { super(); this.name = options.name || 'machine'; this.state = options.initial; this.context = options.context || {}; this.transitions = []; this.history = []; this.strict = options.strict !== false; }
  add(input, options) { const transition = input instanceof Transition ? input : new Transition({ ...options, ...input }); this.transitions.push(transition); return this; }
  find(event) { return this.transitions.filter(transition => transition.event === event && (transition.from === '*' || transition.from === this.state)); }
  can(event) { return this.find(event).some(transition => transition.guard(this.context)); }
  async send(event, payload) {
    const candidates = this.find(event); const transition = candidates.find(value => value.guard(this.context));
    if (!transition) { if (this.strict) throw new Error(`No transition for ${this.state} + ${event}`); return { changed: false, state: this.state }; }
    const previous = this.state; await transition.action(this.context, payload);
    this.state = typeof transition.to === 'function' ? transition.to(this.context, payload) : transition.to;
    const record = { machine: this.name, event, from: previous, to: this.state, payload, at: new Date().toISOString() };
    this.history.push(record); this.emit('transition', record); this.emit(`state:${this.state}`, record);
    return { changed: previous !== this.state, state: this.state, record };
  }
  reset(state = this.history[0]?.from) { this.state = state; this.history = []; return this; }
  snapshot() { return { name: this.name, state: this.state, context: structuredClone(this.context), history: structuredClone(this.history) }; }
  restore(snapshot) { this.state = snapshot.state; this.context = structuredClone(snapshot.context || {}); this.history = structuredClone(snapshot.history || []); return this; }
}

class StateMachineRegistry {
  constructor() { this.machines = new Map(); }
  register(machine) { if (this.machines.has(machine.name)) throw new Error(`Machine exists: ${machine.name}`); this.machines.set(machine.name, machine); return machine; }
  get(name) { const machine = this.machines.get(name); if (!machine) throw new Error(`Machine not found: ${name}`); return machine; }
  snapshot() { return Object.fromEntries([...this.machines].map(([name, machine]) => [name, machine.snapshot()])); }
  restore(snapshot) { for (const [name, value] of Object.entries(snapshot)) this.get(name).restore(value); return this; }
}

module.exports = { Transition, StateMachine, StateMachineRegistry };
