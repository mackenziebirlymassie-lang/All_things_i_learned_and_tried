'use strict';

const { Transform, Readable, Writable } = require('node:stream');

class ObjectTransform extends Transform {
  constructor(mapper, options = {}) { super({ ...options, objectMode: true }); this.mapper = mapper; this.index = 0; }
  async _transform(value, encoding, callback) { try { const mapped = await this.mapper(value, this.index++); if (mapped !== undefined) this.push(mapped); callback(); } catch (error) { callback(error); } }
}

class FilterTransform extends ObjectTransform {
  constructor(predicate, options = {}) { super(async (value, index) => predicate(value, index) ? value : undefined, options); }
}

class BatchTransform extends Transform {
  constructor(size = 10, options = {}) { super({ ...options, objectMode: true }); this.size = Math.max(1, size); this.batch = []; }
  _transform(value, encoding, callback) { this.batch.push(value); if (this.batch.length >= this.size) { this.push(this.batch); this.batch = []; } callback(); }
  _flush(callback) { if (this.batch.length) this.push(this.batch); callback(); }
}

class CollectWritable extends Writable {
  constructor(options = {}) { super({ ...options, objectMode: true }); this.values = []; this.max = options.max || Infinity; }
  _write(value, encoding, callback) { if (this.values.length >= this.max) return callback(new Error('Collector limit exceeded')); this.values.push(value); callback(); }
}

async function collect(readable) { const values = []; for await (const value of readable) values.push(value); return values; }
function from(values) { return Readable.from(values, { objectMode: true }); }
function map(readable, mapper, options) { return readable.pipe(new ObjectTransform(mapper, options)); }
function filter(readable, predicate, options) { return readable.pipe(new FilterTransform(predicate, options)); }
function batch(readable, size, options) { return readable.pipe(new BatchTransform(size, options)); }

module.exports = { ObjectTransform, FilterTransform, BatchTransform, CollectWritable, collect, from, map, filter, batch };
