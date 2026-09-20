'use strict';

const zlib = require('node:zlib');
const crypto = require('node:crypto');

class CodecError extends Error { constructor(message, code = 'CODEC_ERROR') { super(message); this.name = 'CodecError'; this.code = code; } }
function encodeBase64(value) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function decodeBase64(value) { try { return JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8')); } catch (error) { throw new CodecError(`Invalid base64 JSON: ${error.message}`, 'INVALID_ENCODING'); } }
function encodeCompressed(value) { return zlib.gzipSync(Buffer.from(JSON.stringify(value))).toString('base64url'); }
function decodeCompressed(value) { try { return JSON.parse(zlib.gunzipSync(Buffer.from(String(value), 'base64url')).toString('utf8')); } catch (error) { throw new CodecError(`Invalid compressed JSON: ${error.message}`, 'INVALID_COMPRESSION'); } }
function checksum(value, algorithm = 'sha256') { return crypto.createHash(algorithm).update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex'); }

class Cursor {
  constructor(input = {}) { this.position = Number(input.position) || 0; this.limit = input.limit == null ? null : Number(input.limit); this.sort = input.sort || null; this.filter = input.filter || null; this.snapshot = input.snapshot || null; }
  next(items) { const values = this.filter ? items.filter(this.filter) : items; const sorted = this.sort ? [...values].sort(this.sort) : values; const end = this.limit == null ? sorted.length : this.position + this.limit; const result = sorted.slice(this.position, end); this.position = end; return { items: result, next: this.position < sorted.length ? this.encode() : null, hasMore: this.position < sorted.length, total: sorted.length }; }
  encode() { return encodeBase64({ position: this.position, limit: this.limit, snapshot: this.snapshot }); }
  static decode(value) { return new Cursor(decodeBase64(value)); }
}

class Envelope {
  constructor(input = {}) { this.version = input.version || 1; this.type = input.type || 'value'; this.id = input.id || crypto.randomBytes(8).toString('hex'); this.createdAt = input.createdAt || new Date().toISOString(); this.payload = input.payload; this.metadata = input.metadata || {}; this.signature = input.signature || null; }
  sign(secret) { this.signature = crypto.createHmac('sha256', secret).update(this.canonical()).digest('hex'); return this; }
  verify(secret) { if (!this.signature) return false; const expected = crypto.createHmac('sha256', secret).update(this.canonical()).digest('hex'); return crypto.timingSafeEqual(Buffer.from(this.signature), Buffer.from(expected)); }
  canonical() { return JSON.stringify({ version: this.version, type: this.type, id: this.id, createdAt: this.createdAt, payload: this.payload, metadata: this.metadata }); }
  serialize(options = {}) { const value = this.canonical(); return options.compress ? encodeCompressed(JSON.parse(value)) : encodeBase64(JSON.parse(value)); }
  static parse(value, options = {}) { return new Envelope(options.compress ? decodeCompressed(value) : decodeBase64(value)); }
}

module.exports = { CodecError, encodeBase64, decodeBase64, encodeCompressed, decodeCompressed, checksum, Cursor, Envelope };
