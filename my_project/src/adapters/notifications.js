'use strict';

const { EventEmitter } = require('node:events');

class Notification {
  constructor(input = {}) {
    this.id = input.id || `notification_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    this.channel = input.channel || 'default';
    this.subject = input.subject || '';
    this.body = input.body || '';
    this.data = input.data || {};
    this.createdAt = input.createdAt || new Date().toISOString();
    this.attempts = input.attempts || 0;
  }
}

class NotificationHub extends EventEmitter {
  constructor(options = {}) {
    super();
    this.channels = new Map();
    this.history = [];
    this.maxHistory = options.maxHistory || 5000;
    this.retry = options.retry || 2;
  }

  register(name, sender, options = {}) {
    if (this.channels.has(name)) throw new Error(`Notification channel exists: ${name}`);
    if (typeof sender !== 'function') throw new TypeError('Notification sender must be a function');
    this.channels.set(name, { sender, options });
    return this;
  }

  unregister(name) {
    return this.channels.delete(name);
  }

  async send(input) {
    const notification = input instanceof Notification ? input : new Notification(input);
    const channel = this.channels.get(notification.channel);
    if (!channel) throw new Error(`Notification channel not found: ${notification.channel}`);
    let error;
    for (let attempt = 1; attempt <= this.retry + 1; attempt += 1) {
      notification.attempts = attempt;
      try {
        const result = await channel.sender(notification, channel.options);
        const record = { notification, status: 'sent', result, sentAt: new Date().toISOString() };
        this.remember(record);
        this.emit('sent', record);
        return record;
      } catch (cause) {
        error = cause;
        this.emit('retry', { notification, attempt, error: cause });
      }
    }
    const record = { notification, status: 'failed', error: { message: error.message, code: error.code || null }, failedAt: new Date().toISOString() };
    this.remember(record);
    this.emit('failed', record);
    throw Object.assign(new Error(`Notification failed: ${error.message}`), { code: 'NOTIFICATION_FAILED', cause: error, record });
  }

  remember(record) {
    this.history.push(record);
    if (this.history.length > this.maxHistory) this.history.shift();
  }

  find(criteria = {}) {
    return this.history.filter(record =>
      (!criteria.channel || record.notification.channel === criteria.channel) &&
      (!criteria.status || record.status === criteria.status) &&
      (!criteria.since || record.notification.createdAt >= criteria.since));
  }

  stats() {
    const sent = this.history.filter(record => record.status === 'sent').length;
    const failed = this.history.filter(record => record.status === 'failed').length;
    return { channels: this.channels.size, history: this.history.length, sent, failed };
  }
}

function consoleChannel(writer = console.log) {
  return notification => {
    writer(`[${notification.channel}] ${notification.subject}\n${notification.body}`);
    return { delivered: true };
  };
}

function memoryChannel(target = []) {
  return notification => {
    target.push(structuredClone(notification));
    return { delivered: true, index: target.length - 1 };
  };
}

module.exports = { Notification, NotificationHub, consoleChannel, memoryChannel };
