# Workflow Engine + Notification Workflow Plan

Status: **proposed** · Target branch: `alpha` · Authored: 2026-06-20

Adds code-first, durable notification **workflows** (Novu `@novu/framework` parity) to the Visulima
family, plus the **digest**, **delay**, **layouts** and **i18n** subsystems that ride on them.

## Locked decisions

| Decision               | Choice                                                                                           | Why                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Packaging              | **Split**: new `@visulima/workflow` (generic engine) + `@visulima/notification/workflow` (steps) | Generic engine is reusable on its own; mirrors Novu (`framework` vs engine) and TanStack (`workflow-core` vs adapters). Lunora can adopt the engine without notification deps. |
| Per-step state machine | **XState v5** internally                                                                         | MIT, zero-dep, edge-safe, ships `getPersistedSnapshot()` + `createActor(logic, { snapshot })` rehydrate — exactly the durable-resume primitive we need.                        |
| Schema input           | **`@standard-schema/spec`** public contract, **Zod v4** internally                               | Users bring any validator (Zod/Valibot/ArkType); we emit JSON Schema via Zod 4 native `z.toJSONSchema()` for future no-code editors.                                           |
| Cron / interval        | **`croner`**                                                                                     | Zero-dep, dual ESM, edge-safe, MIT. `nextRun()` math only (no in-process scheduler).                                                                                           |
| i18n                   | native `Intl.*` + **`intl-messageformat`**                                                       | Native plural/number/date free + ICU MessageFormat templating. No i18next/polyglot.                                                                                            |
| Layouts                | **reuse** existing handlebars/liquid engines                                                     | No new dep; `{{content}}` slot wrap. Code-first (better than Novu's dashboard-only).                                                                                           |
| Durability seam        | **Generic pluggable `Store` contract** (in-memory + KV default; pg-boss/bullmq Node adapters)    | Lunora's Durable-Object/alarm adapter is a **deferred, separate effort** — but the contract is designed so it drops in cleanly.                                                |
| Runtime ethos          | edge-pure core (`fetch` + Web Crypto, no `node:*`/`Buffer`); Node only in store adapters         | Same constraint as `@visulima/notification`.                                                                                                                                   |

## Package topology

```
@visulima/workflow                         NEW standalone package
  .                      defineWorkflow, ctx, run/resume, types
  ./store                Store contract + InMemoryStore + KV (unstorage) store
  ./store/pg-boss        Node durable Store adapter (optional peer)
  ./store/bullmq         Node durable Store adapter (optional peer)
  (future) ./store/durable-object   lunora DO + alarm adapter  ← NOT in this plan

@visulima/notification                     EXISTING package, new subpaths
  ./workflow             step.email/sms/push/chat/inApp/digest/delay; createNotificationWorkflow
  ./layouts              defineLayout + render-with-slot
  ./i18n                 translation store + {{t}} helper for template engines
```

Dependency direction: `notification/workflow` → `@visulima/workflow` (peer) + notification core.
`@visulima/workflow` has **no** notification dependency.

---

## Part A — `@visulima/workflow` (generic durable engine)

### A1. Authoring API

```typescript
import { defineWorkflow } from "@visulima/workflow";
import { z } from "zod";

const onComment = defineWorkflow({
    id: "comment-posted",
    payload: z.object({ author: z.string(), postId: z.string() }), // any Standard Schema
    run: async (ctx) => {
        await ctx.step("a", async () => {
            /* side effect, recorded */
        });
        await ctx.sleep("wait", { amount: 1, unit: "hours" }); // durable pause
        const evt = await ctx.waitForEvent("approved", { timeout: { amount: 1, unit: "days" } });
        await ctx.step("b", async () => {
            /* ... */
        });
    },
});
```

### A2. The `ctx` (run-context) contract

| Method                                   | Semantics                                                                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `ctx.step(id, fn)`                       | Run `fn` once; record output in append-only history. On replay, skip and return recorded value. Idempotency key = `runId:stepId`. |
| `ctx.sleep(id, duration)`                | Persist a wake-at timestamp (via `croner` for cron form), suspend the run, return on resume.                                      |
| `ctx.waitForEvent(name, opts?)`          | Suspend until an external `signal(runId, name, payload)` arrives or `timeout` elapses.                                            |
| `ctx.payload`                            | Validated trigger payload (typed via Standard Schema).                                                                            |
| `ctx.runId`, `ctx.logger`, `ctx.attempt` | Run metadata.                                                                                                                     |

### A3. Replay / durability model (XState-backed)

- Each run is an XState actor; the workflow body is the actor logic.
- State = `{ history: StepRecord[], cursor, status, wakeAt?, waitingFor? }`, all JSON-serializable.
- On suspend (`sleep`/`waitForEvent`): `getPersistedSnapshot()` → `store.save(runId, snapshot)`.
- On resume: `store.load(runId)` → `createActor(logic, { snapshot }).start()` → replay history (steps short-circuit), continue from cursor.
- **Idempotency is the contract**: `ctx.step` side effects must be safe to _skip_ on replay (they are, because outputs are recorded), but never auto-re-run. Document that raw side effects outside `ctx.step` re-execute on replay.

### A4. `Store` contract (the lunora seam)

```typescript
interface WorkflowStore {
    save(runId: string, snapshot: PersistedSnapshot, meta: { wakeAt?: number; waitingFor?: string }): Promise<void>;
    load(runId: string): Promise<PersistedSnapshot | undefined>;
    delete(runId: string): Promise<void>;
    dueRuns(now: number, limit: number): Promise<string[]>; // runs whose wakeAt has passed
    signal(runId: string, event: string, payload: unknown): Promise<void>;
}
```

- `runtime.sweep(now)` — poll `dueRuns`, resume each (the cron/edge entrypoint; lunora later replaces this with DO alarms).
- Ship: `InMemoryStore` (tests/single-instance), `UnstorageStore` (KV/D1/Redis/fs via unstorage — edge-safe).
- Optional Node peers: `PgBossStore`, `BullmqStore`.
- **Designed so a DO/alarm adapter needs no core change** — `dueRuns` becomes a no-op (alarms push instead of poll), `save` schedules an alarm at `wakeAt`. (Adapter itself is out of scope here.)

### A5. Edge safety

Core + InMemory/Unstorage stores: `fetch` + Web Crypto only, no `node:*`. pg-boss/bullmq stores are Node-only optional peers (structural `*Like` typing, no mandatory install). Verified by an edge-import smoke test.

---

## Part B — `@visulima/notification/workflow` (steps)

Wraps the engine; each channel step resolves content then delegates to the **existing** notification
providers + middleware + the `createNotification` facade.

```typescript
import { createNotificationWorkflow } from "@visulima/notification/workflow";

const wf = createNotificationWorkflow(notify, {
    // notify = existing createNotification(...)
    id: "comment-posted",
    payload: z.object({ author: z.string(), postId: z.string(), subscriberId: z.string() }),
    run: async ({ step, payload }) => {
        await step.inApp("inbox", () => ({ to: payload.subscriberId, body: `${payload.author} commented` }));
        await step.delay("cooldown", () => ({ amount: 1, unit: "hours" }));
        await step.email("fallback", () => ({ subject: "New comment", html: "<p>...</p>" }), { skip: ({ payload }) => /* already seen */ false });
    },
});
```

- Channel steps: `step.email`, `step.sms`, `step.push`, `step.chat`, `step.inApp`, `step.webhook` — thin `ctx.step` wrappers that call `notify.sendToChannel(channel, resolved)`; receipts recorded in history.
- `step.delay` → `ctx.sleep`.
- `step.digest` → Part C.
- Per-step `skip` predicate and `providers` override (reuse failover/roundrobin).
- Receipts surface through the existing `Receipt` union + lifecycle **events** bus.

---

## Part C — Digest

```typescript
const digest = await step.digest("collect", () => ({ amount: 10, unit: "minutes" }), { digestKey: payload.postId });
// resumes ONCE with digest.events: { id, time, payload }[]
```

- Aggregation keyed by `subscriberId` + optional `digestKey`.
- Window = interval (`croner` for cron form) → a `ctx.sleep` until the window closes, with an aggregation buffer in the `Store` (`appendToDigest`/`drainDigest` added to the Store contract).
- First event in a window opens it and schedules the wake; subsequent same-key triggers append and do **not** re-open.
- On wake, the workflow resumes once with the drained event array.
- Edge-safe (store-backed).

---

## Part D — Layouts (notification/layouts)

```typescript
import { defineLayout } from "@visulima/notification/layouts";

const branded = defineLayout({
    engine: "handlebars",
    template: `<table>...<tr><td>{{{content}}}</td></tr>...<a href="{{unsubscribeUrl}}">unsub</a></table>`,
});

await step.email("welcome", () => ({ subject: "Hi", body: "<p>Hello</p>", layout: branded, vars: { unsubscribeUrl } }));
```

- `defineLayout({ engine, template })` → renders body, injects into `{{content}}` slot, then renders the layout with `vars`.
- Reuses existing `template-engines/{handlebars,liquid,string}`. No new dep.
- Layout variables work (improvement over Novu). Works for any HTML-bearing channel (email, in-app).

## Part E — i18n (notification/i18n)

```typescript
import { createTranslator } from "@visulima/notification/i18n";

const t = createTranslator({
    locales: { en: { greeting: "Hi {name}" }, de_DE: { greeting: "Hallo {name}" } },
    fallback: "en",
});
// in a step: body: t(subscriber.locale, "greeting", { name })  — or {{t "greeting"}} helper in templates
```

- Locale resolution: subscriber `locale` (ISO lang + optional region, e.g. `de_DE`) → fallback chain → default.
- ICU MessageFormat via `intl-messageformat` (plurals/select); native `Intl.*` for number/date/relative/list.
- `{{t}}` / `{{i18n}}` helper registered into the handlebars/liquid engines, usable inside steps and layouts.
- Fully edge-safe.

---

## Phases

| Phase | Deliverable                                                                                                                                                            | Gate                                                               |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **0** | Scaffold `@visulima/workflow` (package.json, packem, tsconfig, vitest, project.json + Nx tags, exports map). Add deps: xstate, croner, @standard-schema/spec.          | builds empty, lint/types green                                     |
| **1** | Engine core: `defineWorkflow`, `ctx.step/sleep/waitForEvent`, XState actor logic, replay, `Store` contract + `InMemoryStore`, `runtime.sweep`.                         | unit tests: run→suspend→resume, replay idempotency, timeout        |
| **2** | `UnstorageStore` (edge) + optional `PgBossStore`/`BullmqStore` (Node, structural typing). Edge-import smoke test.                                                      | adapters pass shared Store conformance suite                       |
| **3** | `@visulima/notification/workflow`: `createNotificationWorkflow`, channel steps, `step.delay`, skip/provider-override, events wiring.                                   | integration test with mock provider                                |
| **4** | Digest engine (Part C) — store buffer, windowing, single-resume.                                                                                                       | digest aggregation tests (interval + cron + multi-key)             |
| **5** | Layouts (Part D) + i18n (Part E).                                                                                                                                      | render + locale-fallback + ICU plural tests                        |
| **6** | Docs (README + `docs/` mdx for both packages mirroring email/notification), website registration (`category:` tag + packages-metadata.json), runtime matrix.           | docs build, links valid                                            |
| **7** | Full gate + `/thermos:thermos` adversarial review on the new engine (durability/replay correctness, idempotency, edge-purity, schema-validation bypass). Fix findings. | eslint 0, tsc 0, tests green, attw 0, publint clean, thermos clean |

Lint order per house rule: **prettier --write first, then eslint --fix (eslint is the final gate).**

## Test focus (correctness-critical)

- **Replay idempotency**: a step run before a crash must NOT re-run after resume.
- **Suspend/resume round-trip**: snapshot → store → rehydrate → continue at the right cursor.
- **Digest windowing**: open-once semantics, correct event set on drain, cron vs interval.
- **Timeout paths**: `waitForEvent` and `sleep` timeouts fire and resume correctly.
- **Edge purity**: core + edge stores import clean with no `node:*` (smoke test under a constrained resolver).
- **Schema**: invalid payload rejected at trigger; JSON-Schema emission round-trips.

## Risks / watch-items

- **XState snapshot/version compat** — guard against logic changes invalidating in-flight snapshots; include a `version` field in persisted state and a migration note. (Track xstate#5178 history-state restore bug.)
- **Replay safety** — the #1 footgun. Document forcefully: all side effects go through `ctx.step`.
- **TanStack/workflow as reference only** — do NOT depend (v0.0.x + `@tanstack/*` May-2026 supply-chain worm). Study its store contract + `runtime.sweep` model.
- **Lunora DO adapter is deferred** — keep the `Store` contract narrow and poll-optional so the alarm-push variant slots in later without a core change.

## Out of scope (this plan)

- Lunora Durable-Object Store adapter (separate effort; contract is designed for it).
- Headless inbox UI / feed API + realtime (`@novu/react` parity) — most infra-heavy, deferred.
- Tenant/context multi-tenancy layer — optional follow-up over the existing preferences gate.
