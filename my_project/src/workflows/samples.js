'use strict';
const { Task, Workflow, DependencyGraph } = require('../core/engine');
function sampleWorkflows() { const plan = new Task({title:'Plan'}), build = new Task({title:'Build', dependencies:[plan.id]}), test = new Task({title:'Test', dependencies:[build.id]}); return { name:'CI pipeline', tasks:[plan.toJSON(),build.toJSON(),test.toJSON()], graph:new DependencyGraph([plan.toJSON(),build.toJSON(),test.toJSON()]) }; }
module.exports = { sampleWorkflows };
