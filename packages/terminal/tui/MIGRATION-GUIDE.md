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

### Why This Change?

The component library and the runtime have different audiences. Most consumers embed a renderer and a handful of primitives; they were paying for 110+ components and 13 dependencies to get them.

Splitting the two means:

- **A smaller install.** `@visulima/tui` now pulls 3 direct dependencies instead of 13.
- **Two ways to consume components.** `@visulima/tui-kit` is installable like any package, or copy-pasteable through its shadcn registry so you can own and edit the source.
- **Independent release cadence.** Component work no longer forces a version of the renderer, and vice versa.

### Migration Steps

1. Bump `@visulima/tui` to `2.0.0`.
2. Add `@visulima/tui-kit` (or adopt the shadcn registry) if you use any non-primitive component.
3. Run the import rewrite from [the section above](#automating-the-rewrite).
4. Install the optional peers for any heavy component you use — see the table in the README (`BigText`, `Code`, `DiffView`, `Markdown`, `Table`).
5. Drop any explicit `ws` dependency you added for DevTools.
6. Run your type-checker.

### Migration Issues & Solutions

#### 1. A primitive import stopped resolving

**Problem**: `Cannot find module '@visulima/tui-kit/text'` after a bulk find-and-replace.

**Solution**: The 11 primitives stayed in `@visulima/tui`. A blind replace catches them too — use the scripted rewrite above, whose lookahead skips them, or fix them up in a second pass.

#### 2. `static-render` or `textarea` rewritten to the wrong package

**Problem**: The second-pass regex turned `@visulima/tui-kit/static-render` into `@visulima/tui/components/static-render`, or did the same to `textarea`.

**Solution**: Anchor the pattern with the trailing quote-or-slash — `(box|…|text)(["'/])`. Without it, `static` also matches `static-render` and `text` also matches `textarea`, both of which genuinely moved to `@visulima/tui-kit`.

#### 3. A component throws about a missing dependency at runtime

**Problem**: `BigText`, `Code`, `DiffView`, `Markdown` or `Table` fails on a missing `cfonts`, `shiki`, `diff`, `marked` or `@visulima/tabular`.

**Solution**: Those are optional peers, installed only by the consumers that use them. Add the peers listed for that component in the README.

#### 4. DevTools stopped connecting

**Problem**: The React DevTools bridge does not attach after upgrading.

**Solution**: The bridge uses the native `WebSocket`, which needs Node `^22.14.0 || >=24.10.0`. Check your Node version; reinstalling `ws` will not help.

### Verification Steps

1. `pnpm type-check` (or `tsc --noEmit`) — an unresolved import is a compile error, so a mis-rewritten path cannot pass silently.
2. `rg "@visulima/tui/components/" --glob '*.{ts,tsx}'` — every remaining hit should be one of the 11 primitives.
3. Run your test suite, then the app itself: mount a screen and press a key to confirm input still routes.

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
