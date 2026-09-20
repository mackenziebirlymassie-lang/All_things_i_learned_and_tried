'use strict';

const OPERATORS = Object.freeze({
  eq: (left, right) => left === right,
  ne: (left, right) => left !== right,
  gt: (left, right) => left > right,
  gte: (left, right) => left >= right,
  lt: (left, right) => left < right,
  lte: (left, right) => left <= right,
  contains: (left, right) => String(left ?? '').toLowerCase().includes(String(right).toLowerCase()),
  startsWith: (left, right) => String(left ?? '').startsWith(String(right)),
  in: (left, right) => Array.isArray(right) && right.includes(left),
  exists: left => left !== undefined && left !== null
});

function getPath(value, path) {
  return String(path).split('.').reduce((current, key) => current == null ? undefined : current[key], value);
}

function compilePredicate(expression) {
  if (!expression) return () => true;
  if (typeof expression === 'function') return expression;
  if (Array.isArray(expression)) {
    const predicates = expression.map(compilePredicate);
    return value => predicates.every(predicate => predicate(value));
  }
  if (expression.and) {
    const predicates = expression.and.map(compilePredicate);
    return value => predicates.every(predicate => predicate(value));
  }
  if (expression.or) {
    const predicates = expression.or.map(compilePredicate);
    return value => predicates.some(predicate => predicate(value));
  }
  if (expression.not) {
    const predicate = compilePredicate(expression.not);
    return value => !predicate(value);
  }
  const clauses = Object.entries(expression).map(([field, condition]) => {
    if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
      return Object.entries(condition).map(([operator, expected]) => {
        const compare = OPERATORS[operator];
        if (!compare) throw new Error(`Unsupported query operator: ${operator}`);
        return value => compare(getPath(value, field), expected);
      });
    }
    return [value => getPath(value, field) === condition];
  }).flat();
  return value => clauses.every(clause => clause(value));
}

class QueryPlan {
  constructor(input = {}) { this.filter = input.filter || null; this.sort = input.sort || []; this.select = input.select || null; this.limit = input.limit == null ? null : Number(input.limit); this.offset = Math.max(0, Number(input.offset) || 0); this.groupBy = input.groupBy || null; }
  execute(items) {
    let result = [...items].filter(compilePredicate(this.filter));
    if (this.sort) {
      const sorts = Array.isArray(this.sort) ? this.sort : [this.sort];
      result.sort((a, b) => {
        for (const sort of sorts) {
          const field = typeof sort === 'string' ? sort : sort.field;
          const direction = typeof sort === 'string' || sort.direction !== 'desc' ? 1 : -1;
          const left = getPath(a, field); const right = getPath(b, field);
          if (left === right) continue;
          return (left < right ? -1 : 1) * direction;
        }
        return 0;
      });
    }
    const total = result.length;
    result = result.slice(this.offset, this.limit == null ? undefined : this.offset + this.limit);
    if (this.select) result = result.map(item => Object.fromEntries(this.select.map(field => [field, getPath(item, field)])));
    return { items: result, total, offset: this.offset, limit: this.limit };
  }
}

class QueryBuilder {
  constructor(items) { this.items = items; this.plan = {}; }
  where(field, operator, value) { this.plan.filter = { ...(this.plan.filter || {}), [field]: { [operator]: value } }; return this; }
  and(expression) { this.plan.filter = { and: [this.plan.filter || {}, expression] }; return this; }
  or(expression) { this.plan.filter = { or: [this.plan.filter || {}, expression] }; return this; }
  orderBy(field, direction = 'asc') { this.plan.sort = [...(this.plan.sort || []), { field, direction }]; return this; }
  select(...fields) { this.plan.select = fields.flat(); return this; }
  paginate(offset, limit) { this.plan.offset = offset; this.plan.limit = limit; return this; }
  group(field) { this.plan.groupBy = field; return this; }
  run() {
    if (!this.plan.groupBy) return new QueryPlan(this.plan).execute(this.items);
    const groups = new Map();
    for (const item of this.items) { const key = getPath(item, this.plan.groupBy); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(item); }
    return { groups: Object.fromEntries([...groups].map(([key, values]) => [key, new QueryPlan({ ...this.plan, groupBy: null }).execute(values)])), total: this.items.length };
  }
}

function query(items) { return new QueryBuilder(items); }

module.exports = { OPERATORS, getPath, compilePredicate, QueryPlan, QueryBuilder, query };
