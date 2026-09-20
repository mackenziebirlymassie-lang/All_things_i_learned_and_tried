'use strict';

class Principal {
  constructor(input = {}) { this.id = input.id || 'anonymous'; this.roles = new Set(input.roles || []); this.attributes = input.attributes || {}; }
  hasRole(role) { return this.roles.has(role); }
  grant(role) { this.roles.add(role); return this; }
  revoke(role) { this.roles.delete(role); return this; }
}

class Permission {
  constructor(input = {}) { this.name = input.name; this.resource = input.resource || '*'; this.action = input.action || '*'; this.effect = input.effect || 'allow'; this.condition = input.condition || (() => true); this.priority = input.priority || 0; }
  matches(resource, action) { return (this.resource === '*' || this.resource === resource) && (this.action === '*' || this.action === action); }
}

class AccessPolicy {
  constructor(options = {}) { this.permissions = []; this.defaultEffect = options.defaultEffect || 'deny'; }
  grant(resource, action, condition, options = {}) { this.permissions.push(new Permission({ ...options, resource, action, condition, effect: 'allow' })); return this; }
  deny(resource, action, condition, options = {}) { this.permissions.push(new Permission({ ...options, resource, action, condition, effect: 'deny' })); return this; }
  check(principal, resource, action, context = {}) {
    const matches = this.permissions.filter(permission => permission.matches(resource, action)).sort((a, b) => b.priority - a.priority);
    for (const permission of matches) if (permission.condition(principal, context)) return { allowed: permission.effect === 'allow', permission: permission.name || null };
    return { allowed: this.defaultEffect === 'allow', permission: null };
  }
  assert(principal, resource, action, context) { const result = this.check(principal, resource, action, context); if (!result.allowed) throw Object.assign(new Error(`Access denied: ${action} ${resource}`), { code: 'ACCESS_DENIED', principal: principal.id, resource, action }); return result; }
  explain(resource, action) { return this.permissions.filter(permission => permission.matches(resource, action)).map(permission => ({ name: permission.name, effect: permission.effect, priority: permission.priority })); }
}

class ResourceOwnership {
  constructor() { this.owners = new Map(); }
  set(resource, owner) { this.owners.set(resource, owner); return this; }
  owns(principal, resource) { const owner = this.owners.get(resource); return owner === principal.id || principal.hasRole('admin'); }
  assert(principal, resource) { if (!this.owns(principal, resource)) throw new Error(`Resource is owned by another principal: ${resource}`); return true; }
}

function standardAccessPolicy() {
  const policy = new AccessPolicy();
  policy.grant('*', 'read', principal => principal.id !== 'anonymous', { name: 'authenticated-read' });
  policy.grant('*', 'write', principal => principal.hasRole('editor') || principal.hasRole('admin'), { name: 'editor-write' });
  policy.grant('*', '*', principal => principal.hasRole('admin'), { name: 'admin-all', priority: 100 });
  policy.deny('*', 'delete', principal => !principal.hasRole('admin'), { name: 'protected-delete', priority: 90 });
  return policy;
}

module.exports = { Principal, Permission, AccessPolicy, ResourceOwnership, standardAccessPolicy };
