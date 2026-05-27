# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/html` bundles HTML/CSS/JS escaping and sanitization helpers behind one entry. Local code (`src/escape-html.ts` — fast Svelte-derived escaper, `src/html.ts` — tagged-template literal, `src/css.ts`) is combined with curated re-exports from `@std/html`, `html-entities`, `html-tags`, `sanitize-html`, and `string-strip-html`.

## Architecture

- Single export entry (`.`) — every helper is re-exported from `src/index.ts`. Several re-exports come from third-party packages; if you bump those versions, check that no public names have changed.
- Runtime dependencies (`csstype`, `sanitize-html`) — `sanitize-html` is Node-leaning (depends on `parse5`/DOM-like APIs), so this package is not strictly browser-safe. Keep that in mind when adding code paths.
- `FlexibleCSSProperties` is a custom relaxation of `csstype`'s `Properties` — preserve it; some downstream consumers rely on the wider value type.
- `html`, `escapeHtml`, `css` use `default as` re-exports. Watch for `import/no-extraneous-dependencies` lint suppressions on re-exports — the `attw` script intentionally ignores `internal-resolution-error no-resolution`.
- `@std/html` is consumed from JSR (`jsr:@std/html@1.0.5`); upgrades use the `jsr:` specifier.
