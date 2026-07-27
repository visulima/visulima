# Migration Guide

This guide documents breaking changes and migration steps for the `@visulima/tui` package.

## Version 2.0.0

### Breaking Changes Summary

- **Component library moved**: every non-primitive component now lives in `@visulima/tui-kit`
- **`ws` removed**: the DevTools bridge uses the platform-native `WebSocket`
- **Unchanged**: the renderer, every hook, and the layout/text primitives

`@visulima/tui` keeps the runtime — the Ink-compatible renderer, the hooks, and the primitives every component is built on. Its direct dependencies drop from 13 to 3 (`@visulima/colorize`, `scheduler`, `yoga-layout`). If you only use `render`, `Box`, `Text` and the hooks, a dependency bump is the whole migration.

### Component library moved to `@visulima/tui-kit`

The 110+ higher-level components that lived under `@visulima/tui/components/*` moved to a new package, shipped both as an installable library and as a shadcn-style copy-paste registry.

#### Before (v1.x)

```ts
import { Accordion } from "@visulima/tui/components/accordion";
import { Spinner } from "@visulima/tui/components/spinner";
```

#### After (v2.x)

```sh
pnpm add @visulima/tui-kit
```

```ts
import { Accordion } from "@visulima/tui-kit/accordion";
import { Spinner } from "@visulima/tui-kit/spinner";
```

Or vendor the source into your own tree instead, with no runtime dependency on the library:

```sh
npx shadcn@latest add https://visulima.com/r/spinner.json
```

The CLI writes the component to `@/components/ui/*`, puts shared helpers in `@/lib/*`, and pulls in whatever that component depends on. The full index is at [`https://visulima.com/r/registry.json`](https://visulima.com/r/registry.json).

#### Primitives that did **not** move

These stay in `@visulima/tui` — leave their imports alone:

`box` · `canvas` · `cursor` · `error-boundary` · `error-overview` · `newline` · `spacer` · `static` · `static-render` · `text` · `transform`

```ts
// Still correct after upgrading:
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
```

#### Automating the rewrite

The rule is mechanical — `@visulima/tui/components/<x>` becomes `@visulima/tui-kit/<x>` unless `<x>` is one of the 11 primitives above. This rewrites every moved import in place; the negative lookahead is what skips the primitives:

```sh
# From your project root. Requires ripgrep + perl.
PRIM='box|canvas|cursor|error-boundary|error-overview|newline|spacer|static|static-render|text|transform'
rg -l "@visulima/tui/components/" --glob '*.{ts,tsx}' \
  | xargs perl -i -pe "s{\@visulima/tui/components/(?!($PRIM)[\"'/])}{\@visulima/tui-kit/}g"
```

Without `perl`, two passes of your editor's regex find-and-replace do the same:

1. Replace `@visulima/tui/components/` with `@visulima/tui-kit/` across the project.
2. Undo the 11 that stayed: replace `@visulima/tui-kit/(box|canvas|cursor|error-boundary|error-overview|newline|spacer|static|static-render|text|transform)(["'/])` with `@visulima/tui/components/$1$2`. The trailing quote-or-slash matters — it stops `static` from also matching `static-render`, and `text` from matching `textarea`.

Run your type-checker afterwards either way. An unresolved import is a compile error, so nothing can rewrite silently wrong.

### `ws` is no longer an optional peer

`ws` only ever backed the React DevTools bridge, which now uses the native `WebSocket` available on the supported Node versions (`^22.14.0 || >=24.10.0`).

- If you installed `ws` explicitly to make DevTools work, remove it.
- If you never used DevTools, this changes nothing.

The rest of the dependency slimming needs no action — those libraries were either inlined or turned into optional peers you only pay for when using the feature that needs them.

## Also in this release (not breaking)

### `suspendTerminal()`

Hand the terminal to a child process — an editor, a pager, a shell — and restore the render afterwards:

```tsx
import { useApp } from "@visulima/tui/hooks/use-app";

const { suspendTerminal } = useApp();

// Callback form — runs with the terminal released, then restores:
await suspendTerminal(async () => {
    await runEditor();
});

// Disposable form — restores on scope exit:
{
    await using _ = await suspendTerminal();
    await runEditor();
}
```

It releases the alternate screen and Kitty keyboard mode on suspend, and restores both with a full redraw on resume.

### Keystrokes are no longer dropped on focus

`useInput` subscribed from a passive effect, which React flushes on its own schedule — after the commit, and potentially after the next I/O callback. A key arriving in that window reached the app, found no handler subscribed, and was discarded with no queue and no retry. In practice a keystroke typed immediately after a component mounted or took focus could be silently lost.

The subscription now happens in a layout effect, flushed synchronously with the commit, so a handler is always in place before the terminal can deliver the next key. No API change.

## Upgrade checklist

1. Bump `@visulima/tui` to `2.0.0`.
2. Add `@visulima/tui-kit` (or adopt the shadcn registry) if you use any non-primitive component.
3. Run the import rewrite above, then your type-checker.
4. Drop any explicit `ws` dependency you added for DevTools.
5. Nothing else — the renderer, hooks, and primitive APIs are unchanged.
