# StyledLine Migration Plan

## Goal

Replace the per-character `StyledChar` object model in the Output class with a columnar `StyledLine` class that uses packed `Uint16Array` + run-length encoded `StyleSpan[]`. This reduces GC pressure (from ~80 objects/line to 1 string + 1 typed array + ~3 spans), improves cache locality, and enables future region-based rendering.

## Architecture Overview

**Current model:** Each visible character is a `StyledChar` object `{value, styles, fullWidth, type}`. An 80-column line = 80 heap objects. A 24-row terminal = 1,920 objects per frame.

**Target model:** Each line is a `StyledLine` with:
- `text: string` — concatenated character values
- `charData: Uint16Array` — per-character: 15-bit offset into text + 1-bit full-width flag
- `spans: StyleSpan[]` — run-length encoded `{length, formatFlags, fgColor?, bgColor?, link?}`

**Key reference:** `jacob314/ink` (master branch) `src/styled-line.ts`, `src/tokenize.ts`, `src/output.ts`

---

## Phase 0: Documentation & API Reference

### Allowed APIs (from jacob314/ink)

**StyledLine class** (`styled-line.ts`):
- `static empty(length): StyledLine` — cached frozen empty lines
- `setChar(index, value, formatFlags, fgColor?, bgColor?, link?)` — core write
- `pushChar(value, formatFlags, fgColor?, bgColor?, link?)` — append
- `getValue(index): string`, `getSpan(index): StyleSpan`, `getFullWidth(index): boolean`
- `clone(): StyledLine`, `slice(start, end?): StyledLine`, `combine(...others): StyledLine`
- `getTrimmedLength(): number`, `trimEnd(): StyledLine`, `equals(other): boolean`
- `getText(): string`, `getSpans(): StyleSpan[]`, `getValues(): string[]`
- `[Symbol.iterator]` — yields `{value, formatFlags, fgColor?, bgColor?, fullWidth, hasStyles}`

**Style flag constants** (`tokenize.ts`):
- `BOLD_MASK=1, DIM_MASK=2, ITALIC_MASK=4, UNDERLINE_MASK=8, STRIKETHROUGH_MASK=16, INVERSE_MASK=32, HIDDEN_MASK=64, FULL_WIDTH_MASK=128`

**Tokenize functions** (`tokenize.ts`):
- `styledLineFromTokens(tokens: Token[]): StyledLine` — converts token array to StyledLine
- `styledLineToString(line: StyledLine): string` — serializes to ANSI string (diff-based)
- `tokenize(str: string): Token[]` — parses ANSI string to tokens

### Files That Must Change

| File | Lines | What changes |
|------|-------|-------------|
| `src/ink/output.ts` | 966 | Core rewrite: grid becomes `StyledLine[]`, operations write via `setChar/pushChar`, `get()` uses `styledLineToString()`, `getBuffer()` reads from StyledLine |
| `src/ink/render-text-node.ts` | 161 | `writeStyledChars()` → write via `StyledLine.setChar()` |
| `src/ink/measure-text.ts` | 304 | `toStyledCharacters()` returns `StyledLine` instead of `StyledChar[]` |
| `src/ink/text-wrap.ts` | 188 | Wrap/truncate operates on `StyledLine` instead of `StyledChar[]` |
| `src/ink/selection.ts` | 455 | `applySelectionToStyledChars()` works with `StyledLine` |
| `src/ink/renderer.ts` | 319 | Update type signatures |
| `src/ink/render-node-to-output.ts` | 513 | Update write calls |
| `src/ink/ansi-to-cell.ts` | ~120 | `packStyledChar()` reads from StyledLine |
| `src/ink/render-border.ts` | 107 | Uses `output.write()` (string path, unchanged) |
| `src/ink/render-background.ts` | 35 | Uses `output.write()` (string path, unchanged) |
| `src/ink/render-scrollbar.ts` | 64 | Uses `output.write()` (string path, unchanged) |

### Anti-patterns to avoid

- Do NOT import `StyledChar` from `@alcalzone/ansi-tokenize` in new code
- Do NOT create per-character objects in hot paths — use `StyledLine.setChar()`
- Do NOT use `Array.from({length}).map(...)` for line initialization — use `StyledLine.empty()`
- Do NOT break the `getBuffer()` path (native Rust renderer)
- Do NOT change the public API of `output.write()` or `output.clip()` in this phase

---

## Phase 1: Add StyledLine and Style Constants

### What to implement

1. Create `src/ink/style-flags.ts` with bitmask constants:
   ```
   BOLD_MASK=1, DIM_MASK=2, ITALIC_MASK=4, UNDERLINE_MASK=8,
   STRIKETHROUGH_MASK=16, INVERSE_MASK=32, HIDDEN_MASK=64, FULL_WIDTH_MASK=128
   ```
   **Copy from:** jacob314/ink `src/tokenize.ts` lines with `export const *_MASK`

2. Create `src/ink/styled-line.ts` — port the complete `StyledLine` class from jacob314/ink `src/styled-line.ts`.
   - Change import of `{FULL_WIDTH_MASK, INVERSE_MASK}` to point to `./style-flags.ts`
   - Keep the Apache-2.0 license header (Google LLC)
   - Export `StyledLine` class and `StyleSpan` type

3. Create `src/ink/styled-line-serializer.ts` — port `styledLineToString()` from jacob314/ink `src/tokenize.ts`.
   - This function converts a `StyledLine` back to an ANSI-escaped string
   - It emits only diff-based escape codes (only when style changes between chars)
   - Import style flags from `./style-flags.ts`

4. Create `src/ink/styled-line-parser.ts` — port `styledLineFromTokens()` from jacob314/ink `src/tokenize.ts`.
   - Converts `Token[]` (from `@alcalzone/ansi-tokenize`'s `tokenize()`) to `StyledLine`
   - Maps AnsiCode styles to formatFlags bitmask
   - Maps color codes to `fgColor`/`bgColor` strings

### Verification checklist

- [ ] `StyledLine.empty(80)` creates an 80-char line of spaces with no styles
- [ ] `StyledLine.empty(80).clone()` returns a mutable copy
- [ ] `line.setChar(0, 'A', BOLD_MASK, 'red')` sets character and style correctly
- [ ] `line.pushChar('B', 0)` appends a character
- [ ] `line.getTrimmedLength()` returns correct trimmed length
- [ ] `line.equals(line.clone())` returns true
- [ ] `styledLineToString(line)` produces correct ANSI output
- [ ] `styledLineFromTokens(tokenize("hello"))` round-trips correctly
- [ ] Unit tests pass for all StyledLine methods

### Anti-pattern guards

- Do NOT use `@alcalzone/ansi-tokenize`'s types in StyledLine — use own `StyleSpan`
- Do NOT import chalk for color handling — use raw ANSI codes
- Do NOT add any dependency on the Output class — StyledLine is self-contained

---

## Phase 2: Bridge Layer — StyledChar ↔ StyledLine Conversion

### What to implement

1. In `src/ink/measure-text.ts`, add a function:
   ```ts
   export function styledCharsToStyledLine(chars: StyledChar[]): StyledLine
   ```
   Converts `StyledChar[]` → `StyledLine` by mapping each char's styles (AnsiCode array) to `formatFlags` bitmask + color extraction.

2. In `src/ink/measure-text.ts`, add a function:
   ```ts
   export function styledLineToStyledChars(line: StyledLine): StyledChar[]
   ```
   Converts `StyledLine` → `StyledChar[]` for backward compatibility.

3. Add a `ansiCodesToFormatFlags()` helper in `src/ink/style-flags.ts`:
   Maps `StyledChar["styles"]` (AnsiCode array from `@alcalzone/ansi-tokenize`) to `{formatFlags, fgColor, bgColor, link}`.

### Verification checklist

- [ ] Round-trip: `styledLineToStyledChars(styledCharsToStyledLine(chars))` preserves values, styles, fullWidth
- [ ] Round-trip: `styledCharsToStyledLine(styledLineToStyledChars(line))` preserves values, spans, fullWidth
- [ ] Bold + red foreground maps to `formatFlags=BOLD_MASK, fgColor="red"`
- [ ] Full-width characters have `FULL_WIDTH_MASK` set in formatFlags
- [ ] All existing tests still pass (no functional change yet)

### Anti-pattern guards

- These bridge functions are TEMPORARY — they exist to allow incremental migration
- Do NOT use them in hot paths in the final code

---

## Phase 3: Migrate Output Grid from StyledChar[][] to StyledLine[]

### What to implement

This is the core change. Modify `src/ink/output.ts`:

1. **Replace grid type:** `outputGrid: StyledChar[][]` → `outputGrid: StyledLine[]`

2. **Replace `getOutputGrid()`:** Instead of filling with `blankCell`, use `StyledLine.empty(width)` for each row. Use `StyledLine.empty()` cache for performance.

3. **Replace `processWriteOperation()`:**
   - Currently: tokenizes text → iterates `StyledChar[]` → writes to `currentLine[offsetX] = character`
   - New: tokenizes text → gets `StyledLine` via `styledLineFromTokens()` → calls `row.setChar(col, value, flags, fg, bg)` for each character
   - Handle clipping at the character level as before

4. **Replace `processStyledWriteOperation()`:**
   - Currently: iterates `StyledChar[]` → writes `row[col] = char`
   - New: use bridge `styledCharsToStyledLine()` temporarily, or iterate chars and call `row.setChar(col, ...)`
   - This is the path used by `render-text-node.ts` for pre-tokenized styled content

5. **Replace `get()` output generation:**
   - Currently: `renderRow()` → string concatenation with `getStylePrefix`/`getStyleTransition`
   - New: `styledLineToString(row.trimEnd())` for each row
   - Remove `renderRow`, `renderStyledRow`, `renderUnstyledRow`, `hasStyledCells`
   - Remove `stylePrefixCache`, `styleTransitionCache`, `continuationCellCache`
   - The `styledLineToString()` function handles diff-based ANSI code generation

6. **Replace `getBuffer()` packing:**
   - Currently: iterates `StyledChar[][]` → `packStyledChar(cell)`
   - New: iterate `StyledLine` rows → for each char, read `getValue(x)`, `getFormatFlags(x)`, `getFgColor(x)`, `getBgColor(x)` and pack into Uint32Array
   - Update `ansi-to-cell.ts` to accept StyledLine data instead of StyledChar

7. **Replace line memoization:**
   - Currently: `isSameRow()` compares cells by identity
   - New: `previousLine.equals(currentLine)` using StyledLine's built-in equals()
   - `copyRowSnapshot()` → `previousLines[i] = currentLine.clone()`

8. **Remove OutputCaches.styledChars cache** — no longer needed since we don't cache `StyledChar[]` per text string. The `getStyledChars()` method becomes `getStyledLine(text: string): StyledLine`.

### Verification checklist

- [ ] `output.write(0, 0, "hello", {transformers:[]})` + `output.get()` returns "hello" (trimmed)
- [ ] `output.write(0, 0, "\x1b[1mBold\x1b[0m", {transformers:[]})` + `output.get()` preserves bold
- [ ] `output.clip({x1:2, x2:6, y1:0, y2:1})` + write + get() clips correctly
- [ ] `output.getBuffer()` produces correct Uint32Array for native renderer
- [ ] Line memoization: second `get()` call with no changes reuses cached lines
- [ ] Full-width characters (CJK) render correctly with continuation cells
- [ ] All existing render tests pass
- [ ] All existing render-to-string benchmarks still work
- [ ] render.bench.ts shows improvement in ops/s (target: >20% on rerender)

### Anti-pattern guards

- Do NOT create StyledChar objects in the new code — use StyledLine throughout
- Do NOT import `@alcalzone/ansi-tokenize`'s `styledCharsToString` — use our `styledLineToString`
- Keep `@alcalzone/ansi-tokenize`'s `tokenize()` for parsing ANSI strings (input path only)
- Do NOT change the public signature of `output.write()` or `output.get()` return type

---

## Phase 4: Migrate Text Pipeline (measure-text, text-wrap, selection)

### What to implement

1. **`src/ink/measure-text.ts`:**
   - `toStyledCharacters(text)` → rename to `toStyledLine(text): StyledLine`
   - Keep backward-compatible `toStyledCharacters()` that delegates to `toStyledLine()` + `styledLineToStyledChars()` (for any remaining consumers)
   - `styledCharsWidth()` → `styledLineWidth(line: StyledLine): number`
   - `measureStyledChars()` → `measureStyledLine()`
   - `splitStyledCharsByNewline()` → `splitStyledLineByNewline(text: string): StyledLine[]`

2. **`src/ink/text-wrap.ts`:**
   - `wrapStyledChars()` → `wrapStyledLine(line: StyledLine, maxWidth, wrapMode): StyledLine[]`
   - Uses `StyledLine.slice()` for splitting at wrap boundaries
   - `truncateStyledChars()` → `truncateStyledLine(line: StyledLine, maxWidth): StyledLine`
   - `sliceStyledChars()` → use `line.slice(from, to)`
   - `wrapOrTruncateStyledChars()` → `wrapOrTruncateStyledLine()`

3. **`src/ink/selection.ts`:**
   - `applySelectionToStyledChars()` → works with `StyledLine`
   - Uses `line.setInverted(index, true)` or `line.setBackgroundColor(index, color)` for selection highlighting

4. **`src/ink/render-text-node.ts`:**
   - `handleTextNode()` pipeline changes:
     - `toStyledCharacters()` → `toStyledLine()`
     - `wrapOrTruncateStyledChars()` → `wrapOrTruncateStyledLine()`
     - `applyPaddingToStyledChars()` → operate on `StyledLine[]`
     - `output.writeStyledChars()` → new `output.writeStyledLine(x, y, line, options)` method
   - Remove `StyledChar[][]` intermediate representation

### Verification checklist

- [ ] Text wrapping at 20 chars produces correct line breaks
- [ ] Truncation with "..." works
- [ ] Selection highlighting inverts the correct character range
- [ ] Full-width chars don't break at column boundaries
- [ ] `splitStyledLineByNewline("a\nb")` returns 2 StyledLines
- [ ] All existing text-wrap tests pass
- [ ] All existing selection tests pass
- [ ] render-to-string benchmarks still work

### Anti-pattern guards

- Do NOT iterate `StyledLine` character-by-character when `slice()` can do the job
- Do NOT create `StyledChar[]` intermediaries in the hot path

---

## Phase 5: Remove StyledChar Dependencies

### What to implement

1. Remove the `writeStyledChars()` method from Output — replace with `writeStyledLine()`
2. Remove `StyledWriteOperation` type — replace with operation that carries `StyledLine`
3. Remove `OutputCaches.getStyledChars()` — replaced by `getStyledLine()`
4. Remove `OutputCaches.getAnsiStyledChars()` and `getPlainStyledChars()`
5. Remove `blankCell`, `continuationBlankCell`, `noStyles` constants
6. Remove `renderRow()`, `renderStyledRow()`, `renderUnstyledRow()`, `hasStyledCells()`
7. Remove `stylePrefixCache`, `styleTransitionCache`, `continuationCellCache`
8. Remove `getContinuationCell()`, `getCharacterWidthForRender()`
9. Update `ansi-to-cell.ts` to read from StyledLine instead of StyledChar
10. Remove `import type { StyledChar }` from all files
11. Remove bridge functions (`styledCharsToStyledLine`, `styledLineToStyledChars`)

### Verification checklist

- [ ] `grep -r "StyledChar" src/ink/` returns zero results (except re-exports for API compat if needed)
- [ ] `grep -r "blankCell\|continuationBlankCell" src/ink/` returns zero results
- [ ] All tests pass
- [ ] All benchmarks pass and show improvement
- [ ] `pnpm run lint:types` passes

### Anti-pattern guards

- Check that no public API types export `StyledChar` — if they do, keep a re-export type alias
- Do NOT remove `@alcalzone/ansi-tokenize` from dependencies if `tokenize()` is still used for parsing

---

## Phase 6: Region-Based Output Model (Future)

> This phase depends on Phases 1-5 being complete. It's a separate initiative.

### What to implement

1. Add `Region` type to output.ts (copy from jacob314/ink)
2. Replace operation queue with immediate writes to region line buffer
3. Add `startChildRegion()`/`endChildRegion()` region stack
4. Replace `get()` with `flattenRegion()` that composites the region tree
5. Add `addRegionTree()` for render caching support

### What NOT to implement in this phase

- Worker-based rendering (terminal-buffer.ts)
- Differential updates
- `StaticRender` component

---

## Phase 7: Render Caching (Future)

> Depends on Phase 6 (Region model).

### What to implement

1. Add `cachedRender?: Region` property to `DOMElement` in `dom.ts`
2. Add `setCachedRender(node, region)` function
3. Add `handleCachedRenderNode()` function (from `render-cached.ts`)
4. Clear `cachedRender` in `cleanupNodeTree()` in reconciler
5. Add `StaticRender` component with `internalOnBeforeRender` hook
6. Check `node.cachedRender` in `renderNodeToOutput()` and short-circuit

---

## Dependency Graph

```
Phase 1: StyledLine + style-flags + serializer + parser
    ↓
Phase 2: Bridge layer (StyledChar ↔ StyledLine)
    ↓
Phase 3: Output grid migration (CORE — largest change)
    ↓
Phase 4: Text pipeline migration (measure, wrap, selection)
    ↓
Phase 5: Remove StyledChar (cleanup)
    ↓
Phase 6: Region model (separate initiative)
    ↓
Phase 7: Render caching (separate initiative)
```

Phases 1-2 are safe and additive (no existing code changes).
Phase 3 is the critical, largest change.
Phases 4-5 are cleanup that follows naturally.
Phases 6-7 are future work that builds on the StyledLine foundation.

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| StyledLine serializer produces different ANSI output than current | Snapshot tests comparing old vs new output |
| getBuffer() (native path) breaks | Dedicated benchmark + Rust renderer integration test |
| Full-width character handling regresses | CJK-specific tests (existing + new) |
| Performance regresses during migration | Run render.bench.ts after each phase |
| Public API breaks | Keep output.write() and output.get() signatures unchanged |
| Large PR size | Phase 1-2 can be merged independently as no-op additions |
