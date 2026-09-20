'use strict';

const { Pipeline } = require('../core/pipeline');

class WorkflowTemplate {
  constructor(input = {}) { if (!input.name) throw new TypeError('Template name is required'); this.name = input.name; this.description = input.description || ''; this.tasks = input.tasks || []; this.variables = input.variables || {}; this.tags = input.tags || []; }
  instantiate(values = {}) {
    const resolved = { ...this.variables, ...values };
    const tasks = this.tasks.map((task, index) => {
      const substitute = value => typeof value === 'string' ? value.replace(/\{\{([^}]+)\}\}/g, (_, key) => resolved[key.trim()] ?? '') : value;
      return Object.fromEntries(Object.entries(task).map(([key, value]) => [key, Array.isArray(value) ? value.map(substitute) : substitute(value)]));
    });
    return { name: this.name, description: this.description, tags: this.tags, tasks };
  }
}

class WorkflowComposer {
  constructor(repository) { this.repository = repository; }
  createFromTemplate(template, values = {}, actor = 'composer') {
    const instance = template instanceof WorkflowTemplate ? template.instantiate(values) : new WorkflowTemplate(template).instantiate(values);
    const created = [];
    for (const task of instance.tasks) created.push(this.repository.addTask(task, actor));
    const byKey = new Map(instance.tasks.map((task, index) => [task.key || task.title, created[index]]));
    for (const source of instance.tasks) {
      for (const dependency of source.dependencies || []) {
        const task = byKey.get(source.key || source.title); const target = byKey.get(dependency);
        if (task && target) this.repository.addDependency(task.id, target.id, actor);
      }
    }
    const workflow = this.repository.addWorkflow({ name: instance.name, description: instance.description, taskIds: created.map(task => task.id), metadata: { template: template.name || template } }, actor);
    return { workflow, tasks: created };
  }
}

class CompositeWorkflow {
  constructor(name, components = []) { this.name = name; this.components = components; }
  add(component) { this.components.push(component); return this; }
  async run(context = {}) {
    const results = [];
    for (const component of this.components) {
      if (typeof component === 'function') results.push(await component(context));
      else if (component && typeof component.run === 'function') results.push(await component.run(context));
      else throw new TypeError('Composite component must be callable');
    }
    return { name: this.name, results };
  }
}

function fanOut(items, mapper, options = {}) {
  const concurrency = Math.max(1, options.concurrency || 4);
  const results = new Array(items.length); let cursor = 0;
  const worker = async () => { while (cursor < items.length) { const index = cursor++; results[index] = await mapper(items[index], index); } };
  return Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker)).then(() => results);
}

function createTaskPipeline(repository, workflowId) {
  return new Pipeline({ name: `workflow:${workflowId}` })
    .use({ name: 'load', run: () => repository.workflow(workflowId) })
    .use({ name: 'validate', run: context => { const workflow = context.get('load'); for (const id of workflow.taskIds) repository.task(id); return workflow; } })
    .use({ name: 'run', run: async context => context.get('runner').run(workflowId) });
}

module.exports = { WorkflowTemplate, WorkflowComposer, CompositeWorkflow, fanOut, createTaskPipeline };
