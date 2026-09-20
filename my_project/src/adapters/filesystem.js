'use strict';

const fs = require('node:fs');
const path = require('node:path');

class PathPolicy {
  constructor(root, options = {}) {
    this.root = path.resolve(root || process.cwd());
    this.allowSymlinks = options.allowSymlinks === true;
    this.readOnly = options.readOnly === true;
  }
  resolve(relative) {
    const result = path.resolve(this.root, String(relative || '.'));
    if (result !== this.root && !result.startsWith(`${this.root}${path.sep}`)) throw new Error('Path escapes adapter root');
    return result;
  }
  assertWrite() { if (this.readOnly) throw new Error('Filesystem adapter is read-only'); }
  assertRegular(file) {
    const stat = fs.lstatSync(file);
    if (!this.allowSymlinks && stat.isSymbolicLink()) throw new Error('Symlinks are disabled by policy');
    return stat;
  }
}

class FilesystemAdapter {
  constructor(options = {}) { this.policy = new PathPolicy(options.root, options); }
  exists(file) { try { this.policy.assertRegular(this.policy.resolve(file)); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
  stat(file) { return this.policy.assertRegular(this.policy.resolve(file)); }
  read(file, encoding = 'utf8') { const resolved = this.policy.resolve(file); this.policy.assertRegular(resolved); return fs.readFileSync(resolved, encoding); }
  readJson(file, fallback) { try { return JSON.parse(this.read(file)); } catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; } }
  write(file, value, encoding = 'utf8') { this.policy.assertWrite(); const resolved = this.policy.resolve(file); fs.mkdirSync(path.dirname(resolved), { recursive: true }); fs.writeFileSync(resolved, value, encoding); return resolved; }
  writeJson(file, value) { return this.write(file, JSON.stringify(value, null, 2)); }
  append(file, value, encoding = 'utf8') { this.policy.assertWrite(); const resolved = this.policy.resolve(file); fs.mkdirSync(path.dirname(resolved), { recursive: true }); fs.appendFileSync(resolved, value, encoding); return resolved; }
  remove(file) { this.policy.assertWrite(); const resolved = this.policy.resolve(file); fs.rmSync(resolved, { recursive: true, force: true }); return true; }
  list(directory = '.', options = {}) {
    const resolved = this.policy.resolve(directory);
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    return entries.filter(entry => !options.hidden && entry.name.startsWith('.') ? false : true).map(entry => ({ name: entry.name, path: path.relative(this.policy.root, path.join(resolved, entry.name)), type: entry.isDirectory() ? 'directory' : 'file' }));
  }
  walk(directory = '.', options = {}) {
    const result = [];
    const visit = relative => {
      for (const entry of this.list(relative, options)) {
        result.push(entry);
        if (entry.type === 'directory' && (!options.maxDepth || relative.split(path.sep).length < options.maxDepth)) visit(entry.path);
      }
    };
    visit(directory);
    return result;
  }
}

module.exports = { FilesystemAdapter, PathPolicy };
