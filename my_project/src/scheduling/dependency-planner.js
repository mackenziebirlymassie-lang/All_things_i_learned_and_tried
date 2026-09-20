'use strict';

class PlanNode {
  constructor(id, input = {}) { this.id = id; this.dependencies = new Set(input.dependencies || []); this.duration = Number(input.duration) || 1; this.priority = Number(input.priority) || 0; this.metadata = input.metadata || {}; }
}

class DependencyPlanner {
  constructor(nodes = []) { this.nodes = new Map(); for (const node of nodes) this.add(node.id || node, node); }
  add(id, input = {}) { if (this.nodes.has(id)) throw new Error(`Plan node exists: ${id}`); const node = input instanceof PlanNode ? input : new PlanNode(id, input); this.nodes.set(id, node); return node; }
  remove(id) { this.nodes.delete(id); for (const node of this.nodes.values()) node.dependencies.delete(id); return this; }
  dependency(id, dependsOn) { const node = this.get(id); this.get(dependsOn); node.dependencies.add(dependsOn); if (this.hasCycle()) { node.dependencies.delete(dependsOn); throw new Error('Dependency creates a cycle'); } return this; }
  get(id) { const node = this.nodes.get(id); if (!node) throw new Error(`Plan node not found: ${id}`); return node; }
  hasCycle() { const visiting = new Set(); const visited = new Set(); const visit = id => { if (visiting.has(id)) return true; if (visited.has(id)) return false; visiting.add(id); for (const dependency of this.get(id).dependencies) if (visit(dependency)) return true; visiting.delete(id); visited.add(id); return false; }; return [...this.nodes.keys()].some(visit); }
  topological() { const result = []; const temporary = new Set(); const permanent = new Set(); const visit = id => { if (permanent.has(id)) return; if (temporary.has(id)) throw new Error('Plan contains cycle'); temporary.add(id); for (const dependency of this.get(id).dependencies) visit(dependency); temporary.delete(id); permanent.add(id); result.push(id); }; for (const id of this.nodes.keys()) visit(id); return result; }
  ready(completed = new Set(), running = new Set(), limit = Infinity) { return [...this.nodes.values()].filter(node => !completed.has(node.id) && !running.has(node.id) && [...node.dependencies].every(id => completed.has(id))).sort((a, b) => b.priority - a.priority || a.duration - b.duration).slice(0, limit); }
  criticalPath() { const order = this.topological(); const distances = new Map(); for (const id of order) { const node = this.get(id); distances.set(id, node.duration + Math.max(0, ...[...node.dependencies].map(dep => distances.get(dep) || 0))); } return Math.max(0, ...distances.values()); }
  levels() { const levels = []; const completed = new Set(); while (completed.size < this.nodes.size) { const ready = this.ready(completed); if (!ready.length) throw new Error('Unable to calculate levels'); levels.push(ready.map(node => node.id)); ready.forEach(node => completed.add(node.id)); } return levels; }
  schedule(concurrency = 1) { const levels = this.levels(); const result = []; for (const level of levels) for (let index = 0; index < level.length; index += concurrency) result.push(level.slice(index, index + concurrency)); return result; }
}

module.exports = { PlanNode, DependencyPlanner };
