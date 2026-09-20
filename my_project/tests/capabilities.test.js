'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ResourcePool, compileExpression, EventStore, NotificationHub, memoryChannel,
  ConfigLayers, RecoveryPlan, Saga, AccessPolicy, Principal, Schema,
  PersistentQueue, QueueWorker, FakeStore
} = require('../src');

test('resource pool leases and dispatches waiters', async () => {
  const pool = new ResourcePool([{ id: 'runner-1', kind: 'runner' }], { ttlMs: 1000 });
  const first = pool.acquire('one', { kind: 'runner' });
  assert.equal(pool.stats().leased, 1);
  const waiting = pool.acquireOrWait('two', { kind: 'runner' }, 1000);
  first.release();
  const second = await waiting;
  assert.equal(second.owner, 'two');
  second.release();
  assert.equal(pool.stats().available, 1);
});

test('expression compiler evaluates safe workflow expressions', () => {
  const expression = compileExpression('upper(task.title) == "BUILD" && task.priority >= 3');
  assert.equal(expression({ task: { title: 'build', priority: 4 } }), true);
  assert.equal(expression({ task: { title: 'test', priority: 4 } }), false);
  assert.throws(() => compileExpression('process.exit()'), /Unknown expression function/);
});

test('event store rebuilds aggregates and snapshots', () => {
  const store = new EventStore();
  store.register('created', (state, event) => ({ ...state, value: event.payload.value }));
  store.register('incremented', (state, event) => ({ ...state, value: state.value + event.payload.amount }));
  const aggregate = store.load('counter', { value: 0 });
  aggregate.record('created', { value: 2 }, store.reducers.get('created'));
  aggregate.record('incremented', { amount: 3 }, store.reducers.get('incremented'));
  store.save(aggregate);
  assert.equal(store.load('counter').state.value, 5);
  store.snapshot(store.load('counter'));
  assert.equal(store.counts().snapshots, 1);
});

test('notification hub retries and records delivery', async () => {
  const delivered = [];
  const hub = new NotificationHub({ retry: 1 });
  hub.register('memory', memoryChannel(delivered));
  const result = await hub.send({ channel: 'memory', subject: 'Build', body: 'Complete' });
  assert.equal(result.status, 'sent');
  assert.equal(delivered.length, 1);
  assert.equal(hub.stats().sent, 1);
});

test('configuration layers merge, interpolate, and explain values', () => {
  const layers = new ConfigLayers();
  layers.add('defaults', { server: { port: 3000 }, mode: 'safe' }, { priority: 1 });
  layers.add('environment', { server: { host: '${HOSTNAME}' }, mode: 'fast' }, { priority: 2 });
  const result = layers.resolve({ variables: { HOSTNAME: 'localhost' } });
  assert.deepEqual(result.server, { port: 3000, host: 'localhost' });
  assert.equal(result.mode, 'fast');
  assert.equal(layers.explain('mode').length, 2);
});

test('saga compensates completed work after failure', async () => {
  const actions = [];
  const saga = new Saga({ name: 'release' });
  saga.step('reserve', async () => { actions.push('reserve'); }, async () => { actions.push('release'); });
  saga.step('publish', async () => { actions.push('publish'); throw new Error('network'); }, async () => {});
  const result = await saga.run();
  assert.equal(result.status, 'compensated');
  assert.deepEqual(actions, ['reserve', 'publish', 'release']);
});

test('recovery plan runs compensations in reverse order', async () => {
  const values = [];
  const plan = new RecoveryPlan();
  plan.add({ name: 'one', run: () => values.push('one') });
  plan.add({ name: 'two', run: () => values.push('two') });
  const result = await plan.execute({});
  assert.equal(result.status, 'completed');
  assert.deepEqual(values, ['two', 'one']);
});

test('access policy handles roles and deny precedence', () => {
  const policy = new AccessPolicy();
  policy.grant('task', 'read', principal => principal.hasRole('viewer'));
  policy.deny('task', 'delete', () => true, { priority: 5 });
  const viewer = new Principal({ id: 'u1', roles: ['viewer'] });
  assert.equal(policy.check(viewer, 'task', 'read').allowed, true);
  assert.equal(policy.check(viewer, 'task', 'delete').allowed, false);
});

test('schema validates and coerces task-like data', () => {
  const schema = new Schema({ type: 'object', properties: { title: { type: 'string', required: true }, timeout: { type: 'number', min: 1 } } }, { coerce: true });
  const result = schema.validate({ title: 'Build', timeout: '10' });
  assert.equal(result.valid, true);
  assert.equal(result.value.timeout, 10);
});

test('persistent queue worker acknowledges jobs', async () => {
  const store = new FakeStore({ queue: [] });
  const queue = new PersistentQueue({ store });
  queue.enqueue({ workflowId: 'w1', payload: { value: 3 } });
  const worker = new QueueWorker(queue, async job => job.payload.value * 2, { pollMs: 1 });
  await worker.tick();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(queue.stats().byStatus.completed, 1);
});
