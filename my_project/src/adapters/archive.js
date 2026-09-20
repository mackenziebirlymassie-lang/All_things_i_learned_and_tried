'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

function checksum(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

class ArchiveWriter {
  constructor(options = {}) { this.root = path.resolve(options.root || process.cwd()); this.maxBytes = options.maxBytes || 50 * 1024 * 1024; }
  resolve(file) {
    const target = path.resolve(this.root, file);
    if (target !== this.root && !target.startsWith(`${this.root}${path.sep}`)) throw new Error('Archive path escapes root');
    return target;
  }
  collect(directory = '.') {
    const root = this.resolve(directory);
    const result = [];
    const visit = current => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) visit(absolute);
        else {
          const relative = path.relative(root, absolute);
          const content = fs.readFileSync(absolute);
          result.push({ path: relative, mode: fs.statSync(absolute).mode, size: content.length, checksum: checksum(content.toString('base64')), content: content.toString('base64') });
        }
      }
    };
    visit(root);
    return result;
  }
  pack(directory = '.') {
    const files = this.collect(directory);
    const payload = Buffer.from(JSON.stringify({ version: 1, createdAt: new Date().toISOString(), files }));
    if (payload.length > this.maxBytes) throw new Error('Archive exceeds size limit');
    return zlib.gzipSync(payload);
  }
  write(directory, destination) {
    const data = this.pack(directory);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, data);
    return { destination, bytes: data.length, checksum: checksum(data.toString('base64')) };
  }
}

class ArchiveReader {
  constructor(options = {}) { this.maxFiles = options.maxFiles || 10000; this.maxBytes = options.maxBytes || 100 * 1024 * 1024; }
  read(source) {
    const compressed = Buffer.isBuffer(source) ? source : fs.readFileSync(source);
    const payload = zlib.gunzipSync(compressed);
    if (payload.length > this.maxBytes) throw new Error('Uncompressed archive exceeds size limit');
    const archive = JSON.parse(payload.toString('utf8'));
    if (!Array.isArray(archive.files) || archive.files.length > this.maxFiles) throw new Error('Invalid archive file list');
    for (const file of archive.files) {
      if (!file.path || path.isAbsolute(file.path) || file.path.split(/[\\/]/).includes('..')) throw new Error('Archive contains unsafe path');
      const content = Buffer.from(file.content, 'base64');
      if (content.length !== file.size || checksum(content.toString('base64')) !== file.checksum) throw new Error(`Archive checksum failed: ${file.path}`);
    }
    return archive;
  }
  extract(source, destination, options = {}) {
    const archive = this.read(source);
    fs.mkdirSync(destination, { recursive: true });
    for (const file of archive.files) {
      const target = path.resolve(destination, file.path);
      if (!target.startsWith(`${path.resolve(destination)}${path.sep}`)) throw new Error('Archive extraction escaped destination');
      if (!options.overwrite && fs.existsSync(target)) throw new Error(`File exists: ${file.path}`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, Buffer.from(file.content, 'base64'), { mode: file.mode });
    }
    return { files: archive.files.length, destination };
  }
}

module.exports = { ArchiveWriter, ArchiveReader, checksum };
