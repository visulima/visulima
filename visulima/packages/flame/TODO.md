### 3) Next.js-style dev overlay parity for Vite/Webpack

- Status: Planned

- Goals: Parity with modern dev overlays—layered UI, dismiss/restore, multi-error stacking, hydration/runtime hints, option to block reload until fixed.

- UI spec (hard requirements):

    - Dialog-based overlay: render inside a `<dialog id="visulima-flame-dialog" role="dialog" aria-modal="true">` with a shadow root container. Use focus trap and restore focus on close.
    - 1:1 visual parity with the Next.js overlay (as in the screenshot): same header layout, typography scale, spacing, and stack frame presentation. Dark theme default; support light theme via toggle.
    - Sticky header with: error name + short message, file:line:column, "Open in editor" button, copy buttons (stack, codeframe), theme toggle, and dismiss/minimize action.
    - Content regions: Summary panel, Codeframe panel, Stack trace navigator with collapsible groups, Solutions/hints panel (reuse existing rule-based hints).
    - Dismiss/minimize behavior: ESC closes dialog; a small status dot button in the bottom-left lets users re-open. Persist dismissal and theme in `localStorage`.

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

- Implementation notes and references:

    - Follow Astro’s approach of patching Vite’s client by replacing `class ErrorOverlay` with our own and renaming Vite’s to avoid conflicts.
    - We already inject a custom overlay shell via `patch-overlay.ts`; extend this to mount a `<dialog>` and render the extracted `flameHtml`/`flameCss` from the template.
    - Keep the injected client bridge minimal and framework-agnostic; reuse `error-overlay-plugin.ts` wiring for sourcemaps, codeframes, and template rendering.

- Tasks:

    1. Dialog shell and lifecycle
       - Create dialog container with shadow DOM; trap focus and restore on close.
       - Provide dismiss/minimize and a persistent status dot.
    2. Header bar (Next.js parity)
       - Error name/message, file:line:column, open-in-editor, copy actions, theme toggle.
       - Match spacing, font sizes, and iconography as in the screenshot.
    3. Content panels
       - Codeframe with highlighted lines; Stack trace viewer with collapsible groups and keyboard navigation; Solutions panel using rule-based hints.
    4. Theming and accessibility
       - Dark/light themes; visible focus outlines; correct roles/ARIA; keyboard shortcuts (Esc to close, `?` for help, arrow keys/j-k to navigate frames).
    5. State and behavior
       - Persist theme and dismissed state in `localStorage`.
       - Optionally block reloads when `blockReload` is true; expose toggle in UI.
    6. Multi-error handling
       - Maintain a history/stack of recent errors with a switcher; cap by `maxHistory`.
    7. Tests and examples
       - Unit tests for dialog lifecycle, keyboard nav, and rendering; example routes demonstrating multi-error and hydration hints.

- Acceptance criteria:

    - Overlay renders as a modal dialog with correct ARIA and focus management.
    - Visual appearance matches the Next.js overlay from the provided screenshot at 100% parity for spacing/layout/typography of header, codeframe, and stack list.
    - Errors persist across HMR; multiple errors navigable; dismiss/restore works with a status dot.
    - Open-in-editor, copy stack/codeframe, theme toggle, and optional block-reload work.

- Source links:

    - Vite overlay plugin and client bridge: `packages/flame/src/vite/error-overlay-plugin.ts`
    - Overlay patching utilities: `packages/flame/src/vite/overlay/patch-overlay.ts`
    - Overlay UI (to be created): `packages/flame/src/vite/overlay/ui/`