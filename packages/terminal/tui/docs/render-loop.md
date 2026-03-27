# Ratatat Render Loop

> Part of the [Ratatat docs](index.md). See also: [Troubleshooting](troubleshooting.md) · [Architecture Decisions](decisions.md)

Ratatat uses a **game engine style render loop** to drive terminal output. This doc explains why, how it works, and how to tune it.

## The problem with push-based rendering

The naive approach for a React terminal renderer is to paint whenever React commits:

```
React commit → resetAfterCommit() → paint()
```

This works for synchronous state updates triggered by user input. It breaks for timer-driven updates — `setTimeout`, `setInterval`, streaming responses, anything async. React 18's concurrent scheduler in Node.js uses `setImmediate` to batch and defer work. Between user input events, deferred commits pile up and never flush. State changes pile up silently and only appear on the next keypress.

`DiscreteEventPriority` doesn't fix it. Calling `paint()` synchronously from `resetAfterCommit` doesn't fix it reliably either. The scheduler's batching behavior is non-deterministic from the renderer's perspective.

## The solution: decouple state from painting

```
React commit → pendingCommit = true        (React just sets a flag)
setInterval(16ms) → if pendingCommit → paint()   (loop drives all painting)
```

Two independent systems:

**React** owns state. When it commits, it sets `pendingCommit = true`. That's its only job in the paint pipeline.

**The render loop** owns painting. It polls `pendingCommit` every `frameMs` and paints when set. It has no knowledge of React internals and doesn't care what triggered the state change.

## Why this is reliable

The `setInterval` is unconditional. It fires whether the state change came from:

- A keypress
- A `setTimeout` callback
- A `setInterval` tick
- A Promise resolution
- A streaming text update

React's scheduler batching is irrelevant — we're not asking React to drive the paint, we're polling it. Worst-case latency is one frame interval (16ms at 60fps), which is imperceptible in a terminal.

The `setInterval` also keeps the Node.js event loop alive between user inputs. Without it, the event loop could go idle and the `setImmediate`-scheduled React work would have nowhere to land.

## The game engine analogy

A game engine separates the **update tick** (physics, AI, input) from the **render tick** (draw everything). The render tick doesn't wait for the update tick to say "paint now" — it runs at a fixed frequency and draws whatever the current state is.

Ratatat maps directly onto this model:

| Game engine  | Ratatat                                 |
| ------------ | --------------------------------------- |
| Update tick  | React (runs on events + timers)         |
| Render tick  | `setInterval` at `maxFps`               |
| Shared state | `pendingCommit` flag + Yoga layout tree |

The render tick is **pull-based**, not push-based. The loop pulls whenever it sees dirty state. That inversion is what makes it reliable.

## The paint path

When `pendingCommit` is true, one synchronous call chain fires:

```
pendingCommit = true (set by resetAfterCommit)
        │
        ▼
setInterval tick (every frameMs)
        │
        ▼
app.paintNow(calcLayout, renderBuf)
        │
        ├── rootNode.calculateLayout(width, height)    ← Yoga layout
        ├── renderTreeToBuffer(rootNode, buffer, w, h)  ← TS buffer painter
        ├── onBeforeFlush listeners (optional)          ← direct buffer painting
        └── renderer.render(buffer)                    ← Rust diff + stdout write
```

`onBeforeFlush` listeners fire after React fills the buffer but before Rust sees it — the correct insertion point for animated graphs, overlays, or anything that paints directly into the `Uint32Array`. Register via `app.onBeforeFlush(fn)` which returns an unsubscribe function. Multiple listeners are supported.

Resize is handled outside the loop — `SIGWINCH` calls `paintNow()` directly for immediate response.

## CPU cost

The loop runs every 16ms. On frames where nothing changed, the cost is:

1. Check `pendingCommit` — one boolean read, branch not taken
2. That's it

The Yoga layout, buffer paint, and Rust diff only run when `pendingCommit` is true. The Rust diff engine only writes ANSI bytes for cells that actually changed, so a frame where nothing visually changed produces zero terminal writes.

## Tuning with `maxFps`

```ts
render(<App />, { maxFps: 30 })  // 33ms frame interval — half the CPU overhead
render(<App />, { maxFps: 60 })  // 16ms frame interval — default
render(<App />, { maxFps: 120 }) // 8ms frame interval — smoother animations
```

Lower `maxFps` reduces how often the loop wakes up. For apps without animation (static dashboards, prompts), `maxFps: 10` or even `maxFps: 4` is perfectly usable and costs almost nothing.

Higher `maxFps` reduces maximum paint latency for smooth streaming or animations.

## Where this lives in the code

- `packages/react/src/react.ts` — render loop setup, `pendingCommit` flag, `frameMs` calculation
- `packages/core/src/app.ts` — `paintNow()` method: layout + buffer paint + Rust render
- `packages/react/src/reconciler.ts` — `resetAfterCommit` sets `pendingCommit = true`
