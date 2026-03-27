# compat-test/

Compatibility harness for running Ink example apps against Ratatat.

## What this directory demonstrates

- Most files are direct ports of Ink examples with import-path changes
- Two files include small TypeScript fixes from upstream example code:
    - `use-focus.tsx` (`label` typing)
    - `use-focus-with-id.tsx` (`id` type)

## Type-check all compat files

```bash
npx tsc -p compat-test/tsconfig.json --noEmit
```

## Run an example

```bash
node --import @oxc-node/core/register compat-test/counter.tsx
node --import @oxc-node/core/register compat-test/borders.tsx
node --import @oxc-node/core/register compat-test/chat.tsx
```

## Coverage matrix

| Example               | Status | Notes                                                            |
| --------------------- | ------ | ---------------------------------------------------------------- |
| borders               | ✅     |                                                                  |
| box-backgrounds       | ✅     |                                                                  |
| chat                  | ✅     |                                                                  |
| concurrent-suspense   | ✅     | `concurrent` option is ignored by Ratatat                        |
| counter               | ✅     |                                                                  |
| incremental-rendering | ✅     | `incrementalRendering` option is ignored                         |
| justify-content       | ✅     |                                                                  |
| static                | ✅     |                                                                  |
| stress-test           | ✅     |                                                                  |
| suspense              | ✅     |                                                                  |
| terminal-resize       | ✅     | `patchConsole` and `exitOnCtrlC` options are ignored             |
| use-focus             | ✅     | Includes upstream typing fix                                     |
| use-focus-with-id     | ✅     | Includes upstream typing fix                                     |
| use-input             | ✅     |                                                                  |
| use-stderr            | ✅     |                                                                  |
| use-stdout            | ✅     |                                                                  |
| use-transition        | ✅     |                                                                  |
| aria                  | ✅     | ARIA props ignored; `useIsScreenReaderEnabled()` returns `false` |
| cursor-ime            | ✅     | `useCursor` is a no-op stub                                      |

Not included in this directory: `select-input`, `table`, `router`, `subprocess-output`, `jest`.
