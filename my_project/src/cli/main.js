#!/usr/bin/env node
'use strict';
const { VERSION, createEngine, runSelfTest } = require('../core/engine');
const { Config } = require('../core/config');
const { renderTable } = require('./reporting');
const { importData } = require('../storage/transfer');
function parse(argv) { const [command = 'help', ...args] = argv; const options = {}; const positionals = []; for (let i=0;i<args.length;i++) { const a=args[i]; if (a.startsWith('--')) { const key=a.slice(2); options[key]=args[i+1] && !args[i+1].startsWith('--') ? args[++i] : true; } else positionals.push(a); } return {command, options, positionals}; }
function help() { return `FlowForge v${VERSION}\n\nUsage: flowforge <command> [options]\n\nCommands:\n  create <title>       Create a task (--priority, --tags, --handler)\n  list                 List tasks (--status, --search)\n  show <id>            Show a task\n  depend <id> <id>     Add dependency\n  workflow <name>      Create workflow (--tasks id,id, --concurrency N)\n  run <workflow-id>    Execute workflow\n  demo                 Run sample workflow\n  report               Show summary\n  events               Show event history (--type, --entityId)\n  export               Print persisted data\n  import <path>        Replace local data with an exported JSON snapshot\n  self-test            Run built-in checks\n  config               Print configuration\n\nGlobal options: --file PATH --json --version\n\nEnvironment: FLOWFORGE_DATA_FILE can set the default data file.`;
}
function required(positionals, count, usage) { if (positionals.length < count) throw new Error(`Missing argument. Usage: ${usage}`); }
async function main(argv=process.argv.slice(2)) { const {command: rawCommand, options, positionals} = parse(argv); const command = rawCommand === '-h' || rawCommand === '--help' ? 'help' : rawCommand; if (command === '--version' || command === '-v' || command === 'version') { console.log(VERSION); return; } if (command === 'self-test') { console.log(JSON.stringify(await runSelfTest(), null, 2)); return; } if (command === 'help') { console.log(help()); return; } const config = new Config(options.file ? {dataFile: options.file} : (process.env.FLOWFORGE_DATA_FILE ? {dataFile: process.env.FLOWFORGE_DATA_FILE} : {})).load(); const app = createEngine({file: config.get('dataFile'), level: config.get('logLevel','warn'), quiet:true}); const r=app.repository; let result;
  if (command === 'create') { required(positionals, 1, 'flowforge create <title>'); result = r.addTask({title: positionals.join(' '), priority: options.priority || 'normal', tags: String(options.tags || '').split(',').filter(Boolean), metadata:{handler:options.handler || 'default'}}, 'cli'); }
  else if (command === 'list') result = r.query.filter({search:options.search, status:options.status});
  else if (command === 'show') { required(positionals, 1, 'flowforge show <id>'); result = r.task(positionals[0]); }
  else if (command === 'depend') { required(positionals, 2, 'flowforge depend <task-id> <dependency-id>'); result = r.addDependency(positionals[0], positionals[1], 'cli'); }
  else if (command === 'workflow') { required(positionals, 1, 'flowforge workflow <name>'); result = r.addWorkflow({name:positionals.join(' '), taskIds:String(options.tasks || '').split(',').filter(Boolean), concurrency:Number(options.concurrency || config.get('concurrency'))}); }
  else if (command === 'run') { required(positionals, 1, 'flowforge run <workflow-id>'); result = await app.runner.run(positionals[0], {actor:'cli'}); }
  else if (command === 'demo') { const a=r.addTask({title:'Plan release', metadata:{handler:'default'}}), b=r.addTask({title:'Build release', metadata:{handler:'compute'}}), c=r.addTask({title:'Verify release', metadata:{handler:'validate'}}); r.addDependency(b.id,a.id); r.addDependency(c.id,b.id); const w=r.addWorkflow({name:'Release pipeline',taskIds:[a.id,b.id,c.id],concurrency:2}); result=await app.runner.run(w.id); }
  else if (command === 'report') result = app.reporter.summary();
  else if (command === 'events') result = r.eventsFor({type:options.type, entityId:options.entityId});
  else if (command === 'export') result = app.reporter.export();
  else if (command === 'import') {
    required(positionals, 1, 'flowforge import <path>');
    const snapshot = importData(positionals[0]);
    if (!snapshot || !Array.isArray(snapshot.tasks) || !Array.isArray(snapshot.workflows) || !Array.isArray(snapshot.events)) {
      throw new Error('Invalid snapshot: expected tasks, workflows, and events arrays');
    }
    app.store.state.tasks = Object.fromEntries(snapshot.tasks.map(task => [task.id, task]));
    app.store.state.workflows = Object.fromEntries(snapshot.workflows.map(workflow => [workflow.id, workflow]));
    app.store.state.events = snapshot.events;
    app.store.save();
    result = { imported: true, tasks: snapshot.tasks.length, workflows: snapshot.workflows.length, events: snapshot.events.length };
  }
  else if (command === 'config') result = config.toJSON();
  else throw new Error(`Unknown command: ${command}`);
  if (options.json || typeof result === 'string') console.log(typeof result === 'string' && !options.json ? result : JSON.stringify(result, null, 2));
  else if (command === 'list') console.log(renderTable(result.map(task => ({id: task.id, status: task.status, priority: task.priority, title: task.title}))));
  else if (command === 'report') console.log(renderTable([{tasks: result.tasks.total, completed: result.tasks.byStatus.completed || 0, completionRate: `${(result.tasks.completionRate * 100).toFixed(1)}%`, workflows: result.workflows.total, events: result.events}]));
  else console.log(JSON.stringify(result, null, 2));
}
if (require.main === module) main().catch(error => { console.error(JSON.stringify({error:error.message, code:error.code || 'CLI_ERROR'}, null, 2)); process.exitCode=1; });
module.exports = { parse, main, help };
