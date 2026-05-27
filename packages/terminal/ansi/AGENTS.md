# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/ansi` is a low-level catalog of ANSI/VT100/xterm escape sequences for terminal control: cursor movement (`cursor.ts`), screen/line erasure (`erase.ts`, `clear.ts`, `screen.ts`), mode setting (`mode.ts`), mouse tracking (`mouse.ts`), hyperlinks (`hyperlink.ts`), iTerm2-specific features incl. inline images (`iterm2.ts`, `image.ts`), status/cursor-position reporting (`status.ts`), window operations (`window-ops.ts`), and ANSI stripping (`strip.ts`). It is the building block other terminal packages compose on top of — it does not render anything itself, only emits strings.

## Architecture

- Each concern lives in its own `src/<name>.ts` and is published as a deep import (`@visulima/ansi/cursor`, `@visulima/ansi/erase`, `@visulima/ansi/strip`, etc.) via the `exports` map. Add new entry points by both creating the file and wiring it into `package.json` `exports` plus the re-export in `src/index.ts`.
- Sequences are exposed as either constants (`CURSOR_UP_1`, `RIS`) or builder functions (`cursorMove(x, y)`, `setWindowTitle(title)`). Prefer adding to the existing module that matches the spec area; only add a new module when a whole new spec section is involved.
- No runtime side effects — pure string returns, ESM-only, `sideEffects: false`. Do not import `node:tty` or anything that depends on a terminal stream.

## Related

- Pairs with `@visulima/colorize` (colors/styles) and `@visulima/is-ansi-color-supported` (capability detection).
- Used by `@visulima/interactive-manager`, `@visulima/tui`, and other rendering layers in this repo.
