'use strict';
const EventEmitter = require('node:events');
class EventBus extends EventEmitter {
  publish(type, payload = {}) { const event = { type, payload, at: new Date().toISOString() }; this.emit(type, event); this.emit('*', event); return event; }
  subscribe(type, handler) { this.on(type, handler); return () => this.off(type, handler); }
  onceEvent(type, handler) { this.once(type, handler); return () => this.off(type, handler); }
}
module.exports = { EventBus };
