'use strict';

const FUNCTIONS = {
  lower: value => String(value ?? '').toLowerCase(),
  upper: value => String(value ?? '').toUpperCase(),
  length: value => String(value ?? '').length,
  exists: value => value !== undefined && value !== null,
  number: value => Number(value),
  string: value => String(value ?? ''),
  date: value => new Date(value)
};

function tokenize(source) {
  const tokens = [];
  const pattern = /\s*(?:(\d+(?:\.\d+)?)|("([^"\\]*(?:\\.[^"\\]*)*)")|([A-Za-z_][A-Za-z0-9_.]*)|(==|!=|>=|<=|&&|\|\||[()+\-*/%!,<>]))/y;
  let index = 0;
  while (index < source.length) {
    pattern.lastIndex = index;
    const match = pattern.exec(source);
    if (!match) throw new SyntaxError(`Unexpected token at ${index}`);
    index = pattern.lastIndex;
    if (match[1]) tokens.push({ type: 'number', value: Number(match[1]) });
    else if (match[2]) tokens.push({ type: 'string', value: JSON.parse(match[2]) });
    else if (match[4]) tokens.push({ type: 'identifier', value: match[4] });
    else tokens.push({ type: 'operator', value: match[5] });
  }
  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

class ExpressionParser {
  constructor(source) {
    this.tokens = tokenize(source);
    this.position = 0;
  }

  current() { return this.tokens[this.position]; }
  take(value) {
    if (value && this.current().value !== value) throw new SyntaxError(`Expected ${value}`);
    return this.tokens[this.position++];
  }

  parse() {
    const value = this.parseOr();
    if (this.current().type !== 'eof') throw new SyntaxError(`Unexpected ${this.current().value}`);
    return value;
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.current().value === '||') { this.take(); const right = this.parseAnd(); left = { type: 'binary', operator: '||', left, right }; }
    return left;
  }

  parseAnd() {
    let left = this.parseEquality();
    while (this.current().value === '&&') { this.take(); const right = this.parseEquality(); left = { type: 'binary', operator: '&&', left, right }; }
    return left;
  }

  parseEquality() {
    let left = this.parseComparison();
    while (['==', '!='].includes(this.current().value)) { const operator = this.take().value; const right = this.parseComparison(); left = { type: 'binary', operator, left, right }; }
    return left;
  }

  parseComparison() {
    let left = this.parseTerm();
    while (['>', '<', '>=', '<='].includes(this.current().value)) { const operator = this.take().value; const right = this.parseTerm(); left = { type: 'binary', operator, left, right }; }
    return left;
  }

  parseTerm() {
    let left = this.parseFactor();
    while (['+', '-'].includes(this.current().value)) { const operator = this.take().value; const right = this.parseFactor(); left = { type: 'binary', operator, left, right }; }
    return left;
  }

  parseFactor() {
    let left = this.parseUnary();
    while (['*', '/', '%'].includes(this.current().value)) { const operator = this.take().value; const right = this.parseUnary(); left = { type: 'binary', operator, left, right }; }
    return left;
  }

  parseUnary() {
    if (this.current().value === '!' || this.current().value === '-') { const operator = this.take().value; return { type: 'unary', operator, value: this.parseUnary() }; }
    return this.parsePrimary();
  }

  parsePrimary() {
    const token = this.current();
    if (token.value === '(') { this.take(); const value = this.parseOr(); this.take(')'); return value; }
    if (token.type === 'number' || token.type === 'string') { this.take(); return { type: 'literal', value: token.value }; }
    if (token.type === 'identifier') {
      this.take();
      if (this.current().value === '(') {
        if (!FUNCTIONS[token.value]) throw new Error(`Unknown expression function: ${token.value}`);
        this.take();
        const args = [];
        if (this.current().value !== ')') { args.push(this.parseOr()); while (this.current().value === ',') { this.take(); args.push(this.parseOr()); } }
        this.take(')');
        return { type: 'call', name: token.value, args };
      }
      return { type: 'path', value: token.value };
    }
    throw new SyntaxError(`Expected expression at ${token.value}`);
  }
}

function evaluateAst(ast, context = {}) {
  if (ast.type === 'literal') return ast.value;
  if (ast.type === 'path') return ast.value.split('.').reduce((value, key) => value == null ? undefined : value[key], context);
  if (ast.type === 'call') {
    const fn = FUNCTIONS[ast.name];
    if (!fn) throw new Error(`Unknown expression function: ${ast.name}`);
    return fn(...ast.args.map(value => evaluateAst(value, context)));
  }
  if (ast.type === 'unary') { const value = evaluateAst(ast.value, context); return ast.operator === '!' ? !value : -value; }
  const left = evaluateAst(ast.left, context);
  if (ast.operator === '&&') return left && evaluateAst(ast.right, context);
  if (ast.operator === '||') return left || evaluateAst(ast.right, context);
  const right = evaluateAst(ast.right, context);
  return ({ '==': () => left === right, '!=': () => left !== right, '>': () => left > right, '<': () => left < right, '>=': () => left >= right, '<=': () => left <= right, '+': () => left + right, '-': () => left - right, '*': () => left * right, '/': () => left / right, '%': () => left % right })[ast.operator]();
}

function compileExpression(source) {
  const ast = new ExpressionParser(source).parse();
  const validate = node => {
    if (!node) return;
    if (node.type === 'call' && !FUNCTIONS[node.name]) throw new Error(`Unknown expression function: ${node.name}`);
    if (node.args) node.args.forEach(validate);
    if (node.value && typeof node.value === 'object') validate(node.value);
    if (node.left) validate(node.left);
    if (node.right) validate(node.right);
  };
  validate(ast);
  const evaluator = context => evaluateAst(ast, context);
  evaluator.ast = ast;
  evaluator.source = source;
  return evaluator;
}

module.exports = { tokenize, ExpressionParser, evaluateAst, compileExpression };
