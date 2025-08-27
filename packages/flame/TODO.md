## Flame roadmap / TODO

This document tracks near-term features and implementation notes for `@visulima/flame`.

### 1) Markdown hints in Solutions panel (rule-based built-ins)

- Goal: Provide actionable, auto-detected hints for common error types directly in the Solutions panel, rendered as Markdown.
- Scope: Implement a small core of rule-based detectors; keep pluggable design so users can add custom `SolutionFinder`s (including AI-backed ones later).

- Initial rule set (examples):
    - Node ESM/CJS interop issues
        - Detect messages like "Cannot use import statement outside a module", "ERR_REQUIRE_ESM", "ERR_MODULE_NOT_FOUND".
        - Hints: explain `type: "module"`, `module` vs `commonjs`, using dynamic `import()`, upgrading dependencies, or using `esm`-compatible builds.
    - Missing default export / export mismatch
        - Match toolchain messages: "Attempted import error: 'X' is not exported", "default export not found", vite/webpack TS errors related to `export default` vs named exports.
        - Hints: show quick examples of correct import/export pairs.
    - Port in use / address in use
        - Detect EADDRINUSE, EACCES; suggest changing port, killing process, or using random port.
    - File not found / path case sensitivity
        - Detect common ENOENT or case mismatch in imports; suggest checking case on Linux/macOS and vite/tsconfig `paths`.
    - TS node resolution / path mapping issues
        - Detect TS2307 and path mapping pitfalls; suggest `tsconfig.paths`, `vite.resolve.alias`, and correct extensions.

- Data sources:
    - `error.name`, `error.message`, parsed stack frames, toolchain-specific error codes where available.

- UI behavior:
    - Solutions panel continues to support Markdown; show multiple rules if applicable, sorted by confidence.
    - Provide small badges per rule (e.g., “ESM”, “Exports”, “Ports”).
    - Collapsible sections for each hint; copy-to-clipboard for code snippets in hints.

- API and extensibility:
    - Continue to accept `solutionFinders: SolutionFinder[]` in `httpDisplayer`/`template`.
    - Add `createRuleBasedSolutionFinder({ rules, projectRoot })` that ships with a default `rules` set; allow opt-in/override.

- Edge cases:
    - Multiple detectors firing—show all, deduplicate repeating guidance.
    - Unknown toolchains—fallback to generic guidance.

- Status: Implemented
    - Implemented `rule-based-finder` with detectors for: ESM/CJS interop, export mismatch, port in use, missing file/case, TS path mapping (TS2307), network/DNS, React hydration mismatch, undefined property access.
    - Wired into `solutions.ts` before `errorHintFinder`.
    - Added unit tests in `packages/flame/__tests__/rule-based-finder.test.ts` (8 tests, passing).
    - Extended `examples/node/index.js` with demo routes: `/esm-cjs`, `/export-mismatch`, `/enoent`, `/ts-paths`, `/dns`, `/hydration`, `/undefined-prop`.

- Follow-ups:
    - [ ] Add visual badges per rule in Solutions panel
    - [ ] Expand rule library (e.g., ENOTFOUND for files, permission errors, SSR-only globals, Webpack/Vite specific codes)
    - [ ] Document usage in README with screenshots

    Source links:
    - Rules: `packages/flame/src/solution/rule-based-finder.ts`
    - Solutions panel renderer: `packages/flame/src/template/components/error-card/solutions.ts`
    - Tests: `packages/flame/__tests__/rule-based-finder.test.ts`

### 2) Accessibility and keyboard/ARIA improvements

- Status: In progress
    - Implemented: focus trap around overlay; ARIA roles/labels for tabs/regions; keyboard toggle for Solutions panel; Stack viewer tab/tabpanel semantics; keyboard shortcuts help dialog ("?" button and Shift+/); improved button accessibility (Enter/Space).
    - Remaining: axe checks, skip link, focus outlines, tab order verification, comprehensive SR testing.

- Goals: WCAG-friendly experience; fully usable via keyboard and screen readers.

- Focus management:
    - Trap focus within the overlay/dialog when open; restore focus on close.
    - Ensure first interactive element is focused on open; maintain visible focus styles.

- Roles and ARIA attributes:
    - Tabs: use `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`, `id` linking.
    - Disclosure groups (stack groups): `<details>` sync with `aria-expanded` where needed; ensure toggles are labeled.
    - Tooltips: ensure `aria-describedby` and keyboard reachability.
    - Buttons and links: proper `aria-label` where text is not explicit.

- Keyboard shortcuts:
    - Frame navigation: `j/k` or arrow keys to move; `Enter`/`Space` to open frame.
    - Toggle groups: `t` to expand/collapse current group.
    - Open in editor: `o`.
    - Theme toggle: `Shift+D`.
    - Close overlay: `Esc` (for dev overlay context).

- Testing:
    - Add a11y unit tests where feasible; run axe-core on rendered HTML during CI for critical views.

- Tasks:
    - [x] Audit current markup; add missing roles/labels (stack trace viewer, solutions panel regions, sticky header labels)
    - [x] Implement focus trap and restore logic (overlay container; dialog semantics)
    - [x] Add keyboard bindings and help tooltip/cheatsheet ("?" button + Shift+/ dialog)
    - [ ] Add axe-core checks to CI (dev overlay pages)
    - [x] Add visible focus outlines and ensure high-contrast friendliness
        - [ ] Add a "Skip to stack trace" link for keyboard users
    - [x] Verify tab order and aria-selected updates dynamically across tabs/groups
        - [ ] Screen reader QA on NVDA/JAWS/VoiceOver

    Source links:
    - Focus trap & shortcuts dialog: `packages/flame/src/template/layout.ts`
    - Sticky header a11y: `packages/flame/src/template/components/error-card/sticky-header.ts`
    - Stack trace viewer roles/ARIA: `packages/flame/src/template/components/stack-trace-viewer/index.ts`
    - Header bar editor selector visibility: `packages/flame/src/template/components/header-bar/index.ts`

### 3) Next.js-style dev overlay parity for Vite/Webpack

- Status: Not started

- Goals: Parity with modern dev overlays—layered UI, dismiss/restore, multi-error stacking, hydration/runtime hints, option to block reload until fixed.

- Core behaviors:
    - Layered overlay that persists across HMR events.
    - Multiple errors shown as a stack; quick switcher to navigate.
    - Dismissible with a small status dot/button to re-open.

- Runtime hydration hints:
    - Capture React/Vue/Svelte hydration and SSR mismatch errors; present a guided checklist.
    - For React, parse known error patterns and show reference links.

- Blocking reload:
    - Configurable option to block full page reloads while fatal errors exist, with a visible toggle.

- Plugin options API (Vite):
    - `flameOverlay({ blockReload?: boolean, showRuntimeHints?: boolean, maxHistory?: number })`.
    - Surface `openInEditorUrl` to reuse editor-opening endpoint.

- Webpack integration:
    - Provide a minimal Webpack plugin that hooks into `infrastructureLogging`/`compiler.hooks.done` to forward errors to the overlay client.

- Tasks:
    - [ ] Overlay shell: stacking UI, dismiss/restore, status dot
    - [ ] Multi-error list + navigation
    - [ ] Runtime hydration detectors (React first) and UI surface
    - [ ] `blockReload` implementation and option wiring
    - [ ] Vite plugin options and docs
    - [ ] Webpack bridge (MVP) and docs
    - [ ] Examples to demo multi-error flow and hydration hints

    Source links:
    - Vite overlay plugin and client bridge: `packages/flame/src/vite/error-overlay-plugin.ts`
    - Overlay patching utilities: `packages/flame/src/vite/overlay/` (target dir for overlay UI)

### 4) Request context panel (servers)

- Status: Not started

- Goal: Optional panel providing request details to speed debugging.

- API:
    - `httpDisplayer(err, solutionFinders, { context: { request: { method, url, status?, route?, timings?, headers?, body? } } })`.

- Data captured:
    - Method, URL, query, matched route (if known), status (if set), timings (start/end/elapsed), selected headers (allowlist), and safe body preview.

- Safety and size limits:
    - Truncate large bodies/headers; mask sensitive values (authorization, cookies, secrets) by default.
    - Configurable allowlist/denylist; 16–32 KB total cap with “copy full JSON” button if under cap.

- UI:
    - Collapsible card under the main error section; pretty-printed JSON with syntax highlight.
    - Copy buttons for request line, headers, and body.

- Tasks:
    - [ ] Define context types and sanitization helpers
    - [ ] Implement serializer with masking and size limits
    - [ ] Render Request panel with Shiki highlighting
    - [ ] Copy buttons and truncation indicators
    - [ ] Examples for Node http and Express
    - [ ] README docs

    Source links:
    - HTTP displayer options: `packages/flame/src/displayer/http-displayer.ts`
    - Template wiring: `packages/flame/src/template/index.ts`
    - Request panel (new): `packages/flame/src/template/components/request-panel/` (to be created)

### 5) Click-to-copy: entire stack and minimal reproduction snippet

- Status: Not started

- Goal: Make sharing issues faster by copying the full stack or a generated repro snippet.

- Entire stack copy:
    - Button in header to copy raw stack (and error metadata). Use existing clipboard logic.

- Minimal reproduction snippet:
    - Generate a small Node script including the thrown error, a representative frame, and necessary import/export shape, guarded by comments on how to run.
    - Include package manager hint and Node version if detectable.

- UI placement:
    - Add buttons to the sticky header next to error title; show success feedback.

- Tasks:
    - [ ] Aggregate stack + error metadata into a copy-safe string
    - [ ] Repro script generator with ESM/CJS and TS/JS hints
    - [ ] UI buttons in sticky header; success feedback
    - [ ] Example outputs and README docs

    Source links:
    - Sticky header actions: `packages/flame/src/template/components/error-card/sticky-header.ts`
    - Stack serialization (new): `packages/flame/src/util/stack-serializer.ts` (to be created)

---

### Cross-cutting concerns

- Configuration:
    - Respect `localStorage` for UI prefs (theme, editor, dismissed overlays).
    - Provide server/plugin options with sensible defaults and types.

- Performance:
    - Lazy-load heavy highlighters; reuse singleton Shiki instance.
    - Avoid layout thrash; prefer CSS transitions already present.

- Telemetry (optional, off by default):
    - Optionally track counts of error types shown and features used (client-only, no PII). Opt-in only.

- Docs and examples:
    - Update `README` and add example routes in `examples/node` demonstrating each feature.

- Definition of Done (per feature):
    - Unit tests for detection/logic
    - Example in `examples/node` or dev overlay demo
    - Documentation in `README`
    - a11y check (axe) on rendered HTML where applicable
