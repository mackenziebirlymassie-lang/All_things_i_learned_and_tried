'use strict';
const { WorkflowRunner } = require('../core/engine');
const { WorkerPool } = require('../core/worker-pool');
class TaskEngine extends WorkflowRunner { constructor(options = {}) { super(options); this.pool = new WorkerPool(options.concurrency || 3); } }
module.exports = { TaskEngine };
