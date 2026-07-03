# Service Preflight Example

A minimal workspace for exercising the auto-start service preflight UX in `vis run`.

## Layout

```
packages/
  api/   — declares db, redis, and queue targets as services with TCP readiness probes
  web/   — declares test / integration-test targets that depend on those services
```

Missing services are injected as regular task-graph rows in the run TUI and boot **strictly sequentially** in topological order — the artificial chain stops two services from competing for the same port mid-boot. `api:db` and `api:redis` boot one after the other; `api:queue` waits for `api:db`.

> Why test targets and not a `dev` target?
>
> The current `vis run` handler splits persistent tasks (`preset: "server"`) out of the dep
> graph before service discovery, so service deps declared on a _persistent_ user-invoked
> target don't trigger the preflight today. The example uses non-persistent `test`-style
> targets, which exercise the full preflight + run flow end-to-end. Lifting that limitation
> for `dev` is a follow-up.

## Build vis first

From the **monorepo root** (`visulima/`):

```bash
pnpm --filter "@visulima/task-runner" run build
pnpm --filter "@visulima/vis" run build
```

The example uses the locally-built CLI at `packages/tooling/vis/dist/bin.js`.

## Scenarios

> All commands below run from the monorepo root.

### 1. Happy path — auto-start services sequentially

```bash
node packages/tooling/vis/dist/bin.js run test \
  --cwd=packages/tooling/vis/examples/service-preflight \
  --projects=web \
  --services=ephemeral
```

**Expected:**

1. Run TUI shows `api:db` first. Boot logs stream in real time:
   `[db] simulated boot — running migrations…` → `[db] migrations done, opening port 5432` → `[db] listening on 127.0.0.1:5432`.
2. The row turns green after ~1.5s (the simulated boot delay — see "Why is preflight so fast?" below) and the bootstrap exits 0 the moment the TCP probe passes.
3. `api:redis` runs next, same pattern.
4. `web:test` runs last and logs `web tests OK against DB=postgres://127.0.0.1:5432/app REDIS=redis://127.0.0.1:6379` (env injected from `service.env`).
5. Both services are SIGTERM'd at the end of the run (ephemeral mode — they die with the run).

> **Why `--services=ephemeral`?** In ephemeral mode the child's stdout/stderr is written to a per-service logfile that the bootstrap tails into the run TUI in real time, so you see the boot sequence as it happens. The default for `test` is `--services=persistent` (registry-backed: `vis service start` writes a detached spawn to its own log file and only readiness is observed inline), which means the run TUI mostly stays quiet on a fast happy path. Use `--services=ephemeral` when you want to watch boot logs, `--services=persistent` when you want services to outlive the run.

> **Why is preflight so fast?** `tcp-server.mjs` defaults to `BOOT_DELAY_MS=1500` so the spinner has time to render. Set `BOOT_DELAY_MS=0` to see what an instant-boot service feels like (preflight blinks past in <200ms — that's working as designed). Set it to `5000` to watch the spinner crawl.

### 2. Topological scheduling — service depends on a service

```bash
node packages/tooling/vis/dist/bin.js run test-with-queue \
  --cwd=packages/tooling/vis/examples/service-preflight \
  --projects=web
```

**Expected:** `api:db` boots first. After it goes green, `api:queue` starts.

### 3. Disable auto-start — diagnostic fallback

```bash
node packages/tooling/vis/dist/bin.js run test \
  --cwd=packages/tooling/vis/examples/service-preflight \
  --projects=web \
  --services=off
```

**Expected:** No auto-start. The original `Run \`vis service start api:db\` first…`
diagnostic prints, run aborts.

### 4. Long-ish task — see preflight handoff visually

```bash
node packages/tooling/vis/dist/bin.js run integration-test \
  --cwd=packages/tooling/vis/examples/service-preflight \
  --projects=web
```

`integration-test` waits 2.5s after the services come up — useful for watching the
transition from the last service row to the user task row in the run TUI.

### 5. Force ephemeral lifecycle

```bash
node packages/tooling/vis/dist/bin.js run test \
  --cwd=packages/tooling/vis/examples/service-preflight \
  --projects=web \
  --services=ephemeral
```

Services run in-process for this invocation only — never written to the registry.

### 6. Force registry-backed lifecycle

```bash
node packages/tooling/vis/dist/bin.js run test \
  --cwd=packages/tooling/vis/examples/service-preflight \
  --projects=web \
  --services=persistent
```

After the run completes, services keep running. A reminder line prints:
`2 service(s) started in the background. Run \`vis service stop --all\` to clean up.`

Inspect with:

```bash
node packages/tooling/vis/dist/bin.js service list \
  --cwd=packages/tooling/vis/examples/service-preflight
```

Re-running `vis run test …` immediately skips the preflight (services already registered).

Tear down with:

```bash
node packages/tooling/vis/dist/bin.js service stop --all \
  --cwd=packages/tooling/vis/examples/service-preflight
```

### 7. CI / non-TTY fallback

```bash
CI=true node packages/tooling/vis/dist/bin.js run test \
  --cwd=packages/tooling/vis/examples/service-preflight \
  --projects=web
```

**Expected:** No auto-start; today's diagnostic-then-abort behavior.

### 8. Failure surface — port already taken

In one terminal, occupy 5432:

```bash
nc -l 5432
```

…then in another:

```bash
node packages/tooling/vis/dist/bin.js run test \
  --cwd=packages/tooling/vis/examples/service-preflight \
  --projects=web
```

Because `nc` already bound 5432, the readiness probe trivially passes — but the spawned
`tcp-server.mjs` exits with `EADDRINUSE`. The bind error lands in the per-service logfile
and prints under the `api:db` row in the run TUI; subsequent dependent tasks are skipped.

## Cleanup

```bash
node packages/tooling/vis/dist/bin.js service stop --all \
  --cwd=packages/tooling/vis/examples/service-preflight
```
