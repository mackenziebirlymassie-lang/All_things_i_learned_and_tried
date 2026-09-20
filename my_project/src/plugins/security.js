'use strict';

const crypto = require('node:crypto');

const CAPABILITIES = Object.freeze(['commands', 'handlers', 'hooks', 'filesystem', 'network', 'process', 'configuration']);

class CapabilityPolicy {
  constructor(options = {}) { this.allowed = new Set(options.allowed || ['commands', 'handlers', 'hooks']); this.denied = new Set(options.denied || []); }
  check(capability) { if (!CAPABILITIES.includes(capability)) throw new Error(`Unknown capability: ${capability}`); if (this.denied.has(capability) || !this.allowed.has(capability)) throw new Error(`Plugin capability denied: ${capability}`); return true; }
  grant(capability) { CAPABILITIES.includes(capability) && this.allowed.add(capability); return this; }
  revoke(capability) { this.allowed.delete(capability); this.denied.add(capability); return this; }
  toJSON() { return { allowed: [...this.allowed], denied: [...this.denied] }; }
}

function canonicalManifest(manifest) {
  return JSON.stringify({ name: manifest.name, version: manifest.version, capabilities: [...(manifest.capabilities || [])].sort(), entry: manifest.entry || null });
}

function signManifest(manifest, secret) { return crypto.createHmac('sha256', secret).update(canonicalManifest(manifest)).digest('hex'); }
function verifyManifest(manifest, signature, secret) { return crypto.timingSafeEqual(Buffer.from(signManifest(manifest, secret)), Buffer.from(String(signature))); }

class PluginVerifier {
  constructor(options = {}) { this.secret = options.secret || null; this.requireSignature = options.requireSignature === true; this.allowedVersions = options.allowedVersions || null; }
  verify(plugin) {
    if (!plugin || typeof plugin.name !== 'string') throw new Error('Plugin name is required');
    if (!/^[a-z][a-z0-9._-]{1,63}$/i.test(plugin.name)) throw new Error('Invalid plugin name');
    if (this.allowedVersions && !this.allowedVersions.includes(plugin.version)) throw new Error('Plugin version is not allowed');
    if (this.requireSignature && (!this.secret || !plugin.signature || !verifyManifest(plugin, plugin.signature, this.secret))) throw new Error('Plugin signature verification failed');
    return true;
  }
}

class AuditLog {
  constructor(options = {}) { this.maxEntries = options.maxEntries || 5000; this.entries = []; }
  record(action, details = {}) { const entry = { id: crypto.randomBytes(8).toString('hex'), action, details: structuredClone(details), at: new Date().toISOString() }; this.entries.push(entry); if (this.entries.length > this.maxEntries) this.entries.shift(); return entry; }
  query(criteria = {}) { return this.entries.filter(entry => (!criteria.action || entry.action === criteria.action) && (!criteria.since || entry.at >= criteria.since) && (!criteria.until || entry.at <= criteria.until)); }
  toJSON() { return structuredClone(this.entries); }
}

module.exports = { CAPABILITIES, CapabilityPolicy, canonicalManifest, signManifest, verifyManifest, PluginVerifier, AuditLog };
