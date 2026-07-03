# Why is Ink slow? (and why Ratatat is faster)

> Part of the [Ratatat docs](index.md). See also: [Ink performance plan](ink-performance-plan.md) · [Render Loop](render-loop.md) · [Rendering Modes](rendering-modes.md) · [Raw Buffer API](raw-buffer.md) · [ink-fast PoC implementation](../ink/TECHNICAL-README.md)

Short answer: **Yoga is not the main bottleneck**. Ink and Ratatat both use Yoga in broadly similar ways. The biggest performance difference shows up **after layout** in the render/output pipeline.

This page focuses on high-frequency or full-screen updates (animated dashboards, dense redraws, stress tests). Ink is usually fine for low-frequency CLIs and forms.

Research note: this analysis was executed as a working PoC in [`ink-fast`](../ink/readme.md), with committed snapshots in [`benchmark/render/results`](../ink/benchmark/render/results/README.md).

---

## 1) What Ink and Ratatat do the same

Both pipelines include:

- React reconciler host config
- Yoga layout tree per host node
- layout compute before paint
- terminal ANSI output

So this is **not** a “Yoga vs no-Yoga” story.

---

## 2) Ink render path (where cost accumulates)

Ink (as of the current `ink` package build) flows roughly like this:

```text
React commit
  -> Yoga layout compute
  -> render-node-to-output (tree walk)
  -> Output canvas (JS structures)
  -> ANSI-rich multiline string
  -> log-update (string diff + erase/cursor sequences)
  -> stdout.write(...)
```

Concrete modules in Ink's build output:

- Yoga style mapping: `ink/build/styles.js`
- Host tree + Yoga nodes: `ink/build/dom.js`, `ink/build/reconciler.js`
- Tree -> render ops: `ink/build/render-node-to-output.js`
- Output accumulation: `ink/build/output.js`
- Terminal diff/write orchestration: `ink/build/log-update.js`

### Why this gets expensive under heavy redraw

Ink's backend does a lot of JS text work per frame:

1. **Builds/updates JS output structures** (cell rows, operations)
2. **Handles ANSI-aware text transforms** (`chalk`, color transforms)
3. **Performs width/wrap/truncate logic** (`string-width`, `wrap-ansi`, `cli-truncate`)
4. **Tokenizes styled output** (`@alcalzone/ansi-tokenize` in output path)
5. **Builds large frame strings** and diffs by strings/lines in `log-update`

For sparse/slow updates, this is often totally acceptable.
For dense/high-FPS updates, these JS allocations + string ops become a real CPU/GC cost center.

---

## 3) Ratatat render path (what's different)

Ratatat keeps React+Yoga, but swaps the backend representation and diff layer:

```text
React commit
  -> Yoga layout compute
  -> renderTreeToBuffer(...) into Uint32Array [char, attr]
  -> Rust front/back cell diff
  -> minimal ANSI bytes
  -> stdout lock write
```

Key repo modules:

- App/render loop: `packages/core/src/app.ts`
- Tree -> typed cell buffer: `packages/react/src/renderer.ts`
- Native diff engine: `packages/core/src/lib.rs` (`Renderer::generate_diff`)

Cell format:

```text
buffer[i*2]     = codepoint
buffer[i*2 + 1] = (styles << 16) | (bg << 8) | fg
```

That means no frame-sized ANSI string assembly in JS and no ANSI tokenization pass each frame. The expensive diff is done in native code at cell granularity.

---

## 4) Side-by-side: where bottlenecks usually are

```text
Ink (high-FPS, dense redraws)
[Yoga] -> [JS tree->ops] -> [JS string/tokens/wrap] -> [JS log diff] -> [write]
   low        medium              high                  medium-high      low

Ratatat (high-FPS, dense redraws)
[Yoga] -> [typed buffer fill] -> [Rust cell diff] -> [write]
   low         medium              medium/low         low
```

Again, this is workload-dependent. If your app redraws tiny deltas slowly, Ink may be perfectly adequate.

---

## 5) Why startup timings can be close

Startup benchmarks mostly include:

- process bootstrap
- module load/initialization
- first render setup

Those costs can dominate before steady-state rendering begins. The backend differences show up much more clearly in sustained update workloads.

---

## 6) Practical rule of thumb

Use Ink when:

- updates are infrequent
- output is small/moderate
- portability/ecosystem matters more than max throughput

Use Ratatat when:

- redraw frequency is high
- screen area touched per frame is large
- you need lower backend overhead in terminal rendering

---

## 7) Key takeaways

- **Yoga itself is not the main differentiator** between Ink and Ratatat for heavy redraw workloads.
- Ink's biggest cost center is usually the **post-layout JS text pipeline** (string assembly, tokenization, wrapping, string/line diff).
- Ratatat's biggest advantage is the **typed-cell + native diff backend** (`Uint32Array` -> Rust cell diff).
- **Similar startup times do not imply similar runtime throughput**. Startup and sustained rendering stress different parts of each stack.
- For low-frequency, small-output CLIs, Ink can still be a great fit.

---

## 8) If you wanted to make Ink faster (without switching to Ratatat)

These are Ink-side architecture ideas — same public API, different backend strategy.

1. **Add a cell-buffer backend inside Ink**
    - Keep React + Yoga, but render into a typed cell surface (`char + attr`) instead of producing a frame-sized ANSI string first.
    - Diff cells, then emit ANSI from the diff.
    - This targets the largest current cost center (string-heavy post-layout work).

2. **Keep a persistent output surface between frames**
    - Avoid rebuilding the full `Output` structure every render.
    - Reuse buffers/arrays and update only changed regions.
    - This reduces allocation churn and GC pressure.

3. **Move expensive text processing off the hottest path**
    - Precompute/cache style transforms where possible.
    - Cache wrapped/tokenized text by `(text, width, style)` more aggressively.
    - Focus especially on Unicode-heavy and ANSI-heavy text.

4. **Improve diff granularity beyond whole-string/line updates**
    - Current string/line-oriented updates are simple but can overwork JS for dense changes.
    - A segment/cell-level diff for changed lines would reduce unnecessary rewrite work.

5. **Offer an optional native accelerator**
    - Keep default pure-JS Ink behavior.
    - Add an opt-in native diff/output module for high-performance workloads.
    - This mirrors how many projects keep portability by default while offering a fast path.

6. **Add built-in stage timing/profiling hooks**
    - Expose timings for: tree walk, output assembly, diff generation, terminal write.
    - Better visibility would let Ink users identify whether their bottleneck is layout, string processing, or I/O.
