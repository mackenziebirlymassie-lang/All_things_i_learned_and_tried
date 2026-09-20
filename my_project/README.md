# FlowForge

FlowForge is a standalone, dependency-free Node.js CLI for local task automation and dependency-aware workflows. It stores state in `.flowforge-data.json` and is safe to run offline.

## Quick start

```bash
npm install
npm test
node src/cli/main.js create "Write release notes"
node src/cli/main.js list
node src/cli/main.js demo
```

Use `--file path` for an alternate data store and `--json` for machine-readable output. `FLOWFORGE_DATA_FILE` can set the default data file for CI or shell profiles. Commands include `create`, `list`, `show`, `depend`, `workflow`, `run`, `report`, `events`, `export`, `import`, `config`, and `self-test`. `flowforge --help` and `flowforge --version` are also available.

Without `--json`, `list` and `report` use compact terminal tables; all other commands print structured JSON. Missing required arguments return a non-zero exit code with the expected usage.

### Common examples

```bash
flowforge create "Build artifact" --priority high --tags release,ci
flowforge workflow "Release pipeline" --tasks task_a,task_b --concurrency 2
flowforge report
flowforge export > backup.json
flowforge import backup.json --file restored.json
flowforge --version
```

Exports are validated on import and replace the selected local store with the task, workflow, and event snapshot.

For scripts, prefer `--json` and an explicit `--file` so output and state locations are deterministic.

## Architecture

`src/core` contains validation, event bus, dependency graph, worker abstraction, configuration, logging, and the task engine. `src/storage` provides JSON persistence, caching, and transfer helpers. `src/plugins` exposes a plugin registry compatible with task handlers. `src/cli` owns parsing and terminal reporting. The engine supports retries, timeouts, task dependencies, event history, reporting, and handler plugins without external packages.

The expanded SDK also includes:

* `Scheduler` and `Schedule` for five-field cron expressions, interval aliases, dependency-aware ticks, and controllable timers.
* `FilesystemAdapter`, `ProcessAdapter`, and `HttpAdapter` with root, command, host, timeout, and response-size policies.
* `AnalyticsQuery`, `MetricsRegistry`, and `Tracer` for reports, Prometheus-compatible counters, histograms, and bounded spans.
* `MigrationRunner` and `BackupManager` for ordered state upgrades and rotating local backups.
* `PluginHost` for isolated commands, handlers, hooks, and example plugins.

### Scheduling and queues

`PersistentQueue` provides leased jobs, priority ordering, acknowledgements,
negative acknowledgements with exponential retry, cancellation, expiration
recovery, draining, and worker concurrency. `SchedulePersistence` stores
schedule definitions, dependency edges, queue snapshots, and a checksum so a
restart can resume safely:

```js
const { Scheduler, PersistentQueue, SchedulePersistence } = require('flowforge-cli');
const scheduler = new Scheduler({ runner: app.runner });
const nightly = scheduler.add({ workflowId, expression: '0 2 * * *' });
scheduler.dependsOn(nightly.id, upstreamScheduleId);
```

### Query and reporting DSL

The query DSL supports nested fields, boolean expressions, comparison
operators, sorting, projection, pagination, and grouping. Analytics also
includes aggregations, time-series buckets, forecasts, capacity estimates, and
cooldown-aware alerts:

```js
const { query } = require('./src');
const result = query(tasks)
  .where('priority', 'in', ['high', 'critical'])
  .and({ status: { in: ['backlog', 'ready'] } })
  .orderBy('createdAt', 'desc')
  .paginate(0, 25)
  .run();
```

### Safety and operations

Filesystem, process, HTTP, archive, stream, retry, and memory adapters are
policy-oriented and avoid implicit shell execution. Plugin lifecycle support
adds capability policies, signed manifests, audit history, activation failure
tracking, and clean deactivation. Storage includes integrity manifests,
append-only journals, transactions, indexes, lock files, retention, migration,
backup, restore planning, and dry-run restore validation.

Observability includes structured redacted logging, health/readiness checks,
metrics and Prometheus output, JSON and OTLP exporters, bounded tracing,
tail/rate sampling, event export, and a terminal dashboard renderer. The
`npm test` suite includes integration cases, fixtures, deterministic fake
clocks/stores, and property-style invariant matrices across these modules.

## Validation

```bash
npm test       # 1,466 tests
npm run lint   # node --check for every JavaScript file
npm run count  # exact recursive JavaScript line count
```

Additional core services include a lease-based `ResourcePool` for bounded
workers, a safe expression compiler for conditional workflows, an aggregate
`EventStore` with snapshots and replay, notification channels with retry
history, layered configuration with environment interpolation, and Saga/
compensation recovery. These components are exported from `src/index.js` and
covered by the capability integration suite alongside the existing scheduling,
storage, plugin, analytics, and observability tests.

## Plugin example

```js
const { PluginRegistry } = require('./src/plugins/registry');
const plugins = new PluginRegistry();
plugins.registerPlugin({ name: 'hello', setup(registry) { registry.register('hello', async task => ({ greeting: task.title })); } });
```
