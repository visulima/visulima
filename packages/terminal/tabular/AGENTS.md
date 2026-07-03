# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/tabular` renders ASCII tables and grids that are Unicode-aware (CJK, emoji) and ANSI-color-aware. Two factories from `src/index.ts`: `createTable` / `Table` (`src/table.ts`) for header+row tables with `rowSpan`/`colSpan`, and `createGrid` / `Grid` (`src/grid.ts`) for free-form 2D layouts with `AutoFlowDirection`. Style helpers and border presets are published under the `./style` subpath (`src/style.ts`).

## Architecture

- Zero declared runtime dependencies. `@visulima/string` (width + wrap) and `@visulima/colorize` are devDependencies inlined by the bundler; keep them imported with `// eslint-disable-next-line import/no-extraneous-dependencies` so the `dependencies` block stays empty.
- Types live in `src/types.ts` (`BorderStyle`, `BorderComponent`, `Style`, `TableCell`, `GridCell`, alignment unions) and are the canonical surface — extend the unions there instead of duplicating them per module.
- Width measurement and wrapping must go through `@visulima/string` (`getStringWidth`, `wordWrap`) so ANSI-stripped widths stay consistent with the rest of the terminal stack.

## Related

- Runtime dependency of `@visulima/cerebro` (help/error tables). Optional peer of `@visulima/tui` for the `Table` component. Consumed by `@visulima/vis` (added explicitly as a `dependency` in commit `92d578e7e`).
