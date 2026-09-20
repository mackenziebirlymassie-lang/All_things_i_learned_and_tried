'use strict';

let sequence = 0;

function id(prefix) { sequence += 1; return `fixture_${prefix}_${sequence}`; }
function task(overrides = {}) { return { id: overrides.id || id('task'), title: overrides.title || `Fixture task ${sequence}`, status: overrides.status || 'backlog', priority: overrides.priority || 'normal', tags: overrides.tags || [], dependencies: overrides.dependencies || [], metadata: overrides.metadata || { handler: 'default' }, createdAt: overrides.createdAt || new Date().toISOString(), ...overrides }; }
function workflow(overrides = {}) { return { id: overrides.id || id('workflow'), name: overrides.name || `Fixture workflow ${sequence}`, taskIds: overrides.taskIds || [], concurrency: overrides.concurrency || 2, stopOnFailure: overrides.stopOnFailure !== false, runCount: 0, ...overrides }; }
function event(overrides = {}) { return { id: overrides.id || id('event'), type: overrides.type || 'task.created', entityType: overrides.entityType || 'task', entityId: overrides.entityId || null, timestamp: overrides.timestamp || new Date().toISOString(), payload: overrides.payload || {}, ...overrides }; }
function state(options = {}) {
  const tasks = Array.from({ length: options.tasks || 3 }, (_, index) => task({ id: `task_${index}`, title: `Task ${index}` }));
  const workflowValue = workflow({ id: 'workflow_fixture', taskIds: tasks.map(value => value.id) });
  return { version: 1, savedAt: new Date().toISOString(), tasks: Object.fromEntries(tasks.map(value => [value.id, value])), workflows: { [workflowValue.id]: workflowValue }, events: [], settings: {} };
}
function chain(length = 5) { const tasks = []; for (let index = 0; index < length; index += 1) tasks.push(task({ id: `chain_${index}`, dependencies: index ? [`chain_${index - 1}`] : [] })); return tasks; }
function failureTask(message = 'fixture failure') { return task({ metadata: { handler: 'failure', message } }); }
function completedTask(overrides = {}) { return task({ status: 'completed', startedAt: new Date(Date.now() - 1000).toISOString(), completedAt: new Date().toISOString(), ...overrides }); }
function reset() { sequence = 0; }

module.exports = { task, workflow, event, state, chain, failureTask, completedTask, reset };
