'use strict';

class Transaction {
  constructor(store) { this.store = store; this.original = structuredClone(store.load ? store.load() : store.state); this.working = structuredClone(this.original); this.operations = []; this.closed = false; }
  assertOpen() { if (this.closed) throw new Error('Transaction is closed'); }
  read(path) { this.assertOpen(); return String(path).split('.').reduce((value, key) => value == null ? undefined : value[key], this.working); }
  write(path, value) { this.assertOpen(); const keys = String(path).split('.'); let target = this.working; while (keys.length > 1) { const key = keys.shift(); if (!target[key] || typeof target[key] !== 'object') target[key] = {}; target = target[key]; } target[keys[0]] = structuredClone(value); this.operations.push({ type: 'write', path, value }); return this; }
  update(path, mutator) { return this.write(path, mutator(this.read(path))); }
  delete(path) { this.assertOpen(); const keys = String(path).split('.'); let target = this.working; while (keys.length > 1) { target = target[keys.shift()]; if (!target) return this; } delete target[keys[0]]; this.operations.push({ type: 'delete', path }); return this; }
  async commit() { this.assertOpen(); if (this.store.state) this.store.state = this.working; if (this.store.save) this.store.save(); this.closed = true; return { committed: true, operations: this.operations.length, state: this.working }; }
  rollback() { this.assertOpen(); this.closed = true; this.working = this.original; return { rolledBack: true, operations: this.operations.length }; }
}

class TransactionManager {
  constructor(store) { this.store = store; this.active = null; }
  begin() { if (this.active) throw new Error('Transaction already active'); this.active = new Transaction(this.store); return this.active; }
  async run(operation) { const transaction = this.begin(); try { const result = await operation(transaction); await transaction.commit(); return result; } catch (error) { transaction.rollback(); throw error; } finally { this.active = null; } }
}

module.exports = { Transaction, TransactionManager };
