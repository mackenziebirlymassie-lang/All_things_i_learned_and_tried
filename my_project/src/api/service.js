'use strict';

const { EventEmitter } = require('node:events');
const crypto = require('node:crypto');

class ApiError extends Error {
  constructor(status, message, details = {}) { super(message); this.name = 'ApiError'; this.status = status; this.code = details.code || `HTTP_${status}`; this.details = details; }
}

class RequestContext {
  constructor(input = {}) { this.id = input.id || crypto.randomBytes(8).toString('hex'); this.method = input.method || 'GET'; this.path = input.path || '/'; this.params = input.params || {}; this.query = input.query || {}; this.body = input.body; this.actor = input.actor || 'anonymous'; this.startedAt = Date.now(); this.metadata = {}; }
  set(key, value) { this.metadata[key] = value; return this; }
  get(key, fallback) { return this.metadata[key] === undefined ? fallback : this.metadata[key]; }
  duration() { return Date.now() - this.startedAt; }
}

class Response {
  constructor(status = 200, body = null, headers = {}) { this.status = status; this.body = body; this.headers = { 'content-type': 'application/json', ...headers }; }
  json() { return JSON.stringify(this.body); }
  ok() { return this.status >= 200 && this.status < 300; }
}

class Router {
  constructor() { this.routes = []; this.middleware = []; }
  use(handler) { if (typeof handler !== 'function') throw new TypeError('Middleware must be a function'); this.middleware.push(handler); return this; }
  add(method, pattern, handler, options = {}) { this.routes.push({ method: method.toUpperCase(), pattern, handler, options, match: compilePath(pattern) }); return this; }
  get(path, handler, options) { return this.add('GET', path, handler, options); }
  post(path, handler, options) { return this.add('POST', path, handler, options); }
  put(path, handler, options) { return this.add('PUT', path, handler, options); }
  patch(path, handler, options) { return this.add('PATCH', path, handler, options); }
  delete(path, handler, options) { return this.add('DELETE', path, handler, options); }
  find(method, path) { return this.routes.map(route => ({ route, match: route.match(path) })).find(value => value.route.method === method.toUpperCase() && value.match) || null; }
  async dispatch(input) {
    const context = input instanceof RequestContext ? input : new RequestContext(input);
    const found = this.find(context.method, context.path);
    if (!found) throw new ApiError(404, 'Route not found', { path: context.path });
    context.params = { ...context.params, ...found.match };
    let index = -1;
    const stack = [...this.middleware, async ctx => found.route.handler(ctx)];
    const next = async () => { index += 1; if (index >= stack.length) return; return stack[index](context, next); };
    const result = await next();
    return result instanceof Response ? result : new Response(200, result);
  }
}

function compilePath(pattern) {
  const names = [];
  const source = String(pattern).split('/').map(part => {
    if (part.startsWith(':')) { names.push(part.slice(1)); return '([^/]+)'; }
    if (part === '*') { names.push('wildcard'); return '(.*)'; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('/');
  const regex = new RegExp(`^${source}/?$`);
  return path => { const match = regex.exec(path); if (!match) return null; return Object.fromEntries(names.map((name, index) => [name, decodeURIComponent(match[index + 1])])); };
}

class ApiService extends EventEmitter {
  constructor(options = {}) { super(); this.router = options.router || new Router(); this.auth = options.auth || (async () => true); this.rateLimiter = options.rateLimiter || null; this.logger = options.logger || { info() {}, error() {} }; }
  async handle(input) {
    const context = input instanceof RequestContext ? input : new RequestContext(input);
    try {
      if (this.rateLimiter && !this.rateLimiter.allow()) throw new ApiError(429, 'Rate limit exceeded');
      if (!await this.auth(context)) throw new ApiError(401, 'Unauthorized');
      const response = await this.router.dispatch(context);
      this.emit('request', { context, response, durationMs: context.duration() });
      this.logger.info('api request', { id: context.id, method: context.method, path: context.path, status: response.status });
      return response;
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(500, error.message, { cause: error });
      const response = new Response(apiError.status, { error: apiError.message, code: apiError.code, details: apiError.details });
      this.emit('error', { context, error: apiError, response });
      return response;
    }
  }
}

function standardRoutes(service, app) {
  service.router.get('/health', () => ({ ok: true, at: new Date().toISOString() }));
  service.router.get('/tasks', context => app.repository.query.filter({ search: context.query.search, status: context.query.status }).map(task => task.toJSON()));
  service.router.get('/tasks/:id', context => app.repository.task(context.params.id).toJSON());
  service.router.post('/tasks', context => app.repository.addTask(context.body, context.actor).toJSON());
  service.router.get('/workflows/:id', context => app.repository.workflow(context.params.id).toJSON());
  service.router.get('/events', context => app.repository.eventsFor(context.query));
  return service;
}

module.exports = { ApiError, RequestContext, Response, Router, ApiService, compilePath, standardRoutes };
