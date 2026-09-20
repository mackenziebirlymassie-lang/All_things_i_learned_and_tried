'use strict';

class Dag {
  constructor() { this.nodes = new Map(); }
  add(id, data = {}) { if (this.nodes.has(id)) throw new Error(`Node already exists: ${id}`); this.nodes.set(id, { id, data: structuredClone(data), edges: new Set() }); return this; }
  connect(from, to) { this.node(from).edges.add(to); this.node(to); if (this.cycles()) { this.node(from).edges.delete(to); throw new Error('Edge creates cycle'); } return this; }
  node(id) { const node = this.nodes.get(id); if (!node) throw new Error(`Unknown node: ${id}`); return node; }
  disconnect(from, to) { this.node(from).edges.delete(to); return this; }
  cycles() { const visiting = new Set(); const visited = new Set(); const walk = id => { if (visiting.has(id)) return true; if (visited.has(id)) return false; visiting.add(id); for (const next of this.node(id).edges) if (walk(next)) return true; visiting.delete(id); visited.add(id); return false; }; return [...this.nodes.keys()].some(walk); }
  roots() { const children = new Set([...this.nodes.values()].flatMap(node => [...node.edges])); return [...this.nodes.keys()].filter(id => !children.has(id)); }
  leaves() { const parents = new Set([...this.nodes.values()].flatMap(node => [...node.edges])); return [...this.nodes.keys()].filter(id => !parents.has(id)); }
  order() { const result = []; const visited = new Set(); const visit = id => { if (visited.has(id)) return; visited.add(id); for (const child of this.node(id).edges) visit(child); result.unshift(id); }; for (const id of this.nodes.keys()) visit(id); return result; }
  upstream(id) { const result = new Set(); const walk = candidate => { for (const node of this.nodes.values()) if (node.edges.has(candidate) && !result.has(node.id)) { result.add(node.id); walk(node.id); } }; walk(id); return [...result]; }
  downstream(id) { const result = new Set(); const walk = candidate => { for (const child of this.node(candidate).edges) if (!result.has(child)) { result.add(child); walk(child); } }; walk(id); return [...result]; }
  clone() { const copy = new Dag(); for (const node of this.nodes.values()) copy.add(node.id, node.data); for (const node of this.nodes.values()) for (const edge of node.edges) copy.connect(node.id, edge); return copy; }
  serialize() { return { nodes: [...this.nodes.values()].map(node => ({ id: node.id, data: node.data, edges: [...node.edges] })) }; }
  static deserialize(value) { const dag = new Dag(); for (const node of value.nodes || []) dag.add(node.id, node.data); for (const node of value.nodes || []) for (const edge of node.edges || []) dag.connect(node.id, edge); return dag; }
}

module.exports = { Dag };
