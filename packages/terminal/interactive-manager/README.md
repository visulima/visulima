<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="interactive-manager" />

</a>

<h3 align="center">Interactive terminal output manager for spinners, progress bars, and dynamic updates</h3>

<!-- END_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<br />

<div align="center">

[![typescript-image][typescript-badge]][typescript-url]
[![mit licence][license-badge]][license]
[![npm downloads][npm-downloads-badge]][npm-downloads]

</div>

---

<div align="center">
    <p>
        <sup>
            Daniel Bannert's open source work is supported by the community on <a href="https://github.com/sponsors/prisis">GitHub Sponsors</a>
        </sup>
    </p>
</div>

---

## Install

```sh
npm install @visulima/interactive-manager
```

```sh
yarn add @visulima/interactive-manager
```

```sh
pnpm add @visulima/interactive-manager
```

## Usage

```typescript
import { InteractiveManager, InteractiveStreamHook } from "@visulima/interactive-manager";

const stdoutHook = new InteractiveStreamHook(process.stdout);
const stderrHook = new InteractiveStreamHook(process.stderr);
const manager = new InteractiveManager(stdoutHook, stderrHook);

// Start interactive mode
manager.hook();

// Update output dynamically (re-renders the interactive region in place)
manager.update("stdout", ["Processing...", "50% complete"]);

// End interactive mode and replay any output buffered while hooked
manager.unhook();
```

## API

### `InteractiveManager`

Coordinates a stdout and a stderr hook, owns the cursor, and tracks how many lines the
interactive region currently occupies so it can redraw without leaving artifacts.

#### `manager.update(stream, rows, from = 0)`

Renders `rows` (one string per line) to the given stream (`"stdout"` or `"stderr"`),
erasing the previously rendered region first. Rows wider than the terminal are wrapped,
and the wrapped visual lines are counted correctly when erasing the next frame.

- `from` is the line index from which content is overwritten (used for partial redraws).
- Passing an **empty array** clears the interactive region (equivalent to `clear()`).

```typescript
manager.update("stdout", ["downloading", "[####------] 40%"]);
manager.update("stdout", []); // clear the region
```

#### `manager.clear(stream)`

Wipes the interactive region for a stream and resets the internal line bookkeeping. This
is the intent-revealing way to erase what `update()` last rendered without unhooking.

#### `manager.done(stream)`

Persists the currently rendered frame (leaves it on screen) and resets the bookkeeping so
the next `update()` starts a fresh region below it. Useful for "freezing" a final
spinner/progress frame in the scrollback.

#### `manager.erase(stream, count = manager.lastLength)`

Low-level erase of `count` lines from a stream. Most callers should prefer `clear()`.

#### `manager.suspend(stream, erase = true)` / `manager.resume(stream, eraseRowCount?)`

`suspend()` temporarily releases the hooks so external code can write to the terminal
directly (e.g. a stray `console.log`) without tearing the interactive region; by default
it erases the current region first. `resume()` re-installs the hooks (optionally erasing
`eraseRowCount` leftover lines) and continues interactive rendering.

```typescript
manager.suspend("stdout");
console.log("a one-off log line");
manager.resume("stdout");
```

#### `manager.hook()` / `manager.unhook(separateHistory = true)`

`hook()` installs the stream interceptors and returns `true` on the transition (false if
already hooked). While hooked, all writes to the stream are buffered. `unhook()` releases
the interceptors and **replays the buffered output** in order; `separateHistory` prepends a
blank line before the replayed history. On an interactive TTY, `hook()` also starts
tracking terminal-resize events so frame widths stay correct.

#### Read-only state

`manager.isHooked`, `manager.isSuspended`, `manager.lastLength` (lines in the current
region, counting wrapped lines), `manager.outside` (lines scrolled above the viewport).

### `InteractiveStreamHook`

The per-stream interceptor. You normally create one for stdout and one for stderr and hand
both to an `InteractiveManager`, but it can be used directly.

```typescript
const hook = new InteractiveStreamHook(process.stdout, { maxHistory: 5000 });
```

- **Non-TTY fallback** — when the underlying stream is not a TTY (piped output, CI logs,
  redirection to a file), the hook degrades to plain sequential writes and skips all
  cursor/erase escape sequences, so logs stay readable. Check `hook.isTTY`.
- **Bounded history** — while active, writes are buffered for replay. `maxHistory`
  (default `10000`) caps the buffer; once exceeded, the oldest entries are flushed above
  the interactive region so a long-running, chatty session does not leak memory. Set to
  `Infinity` to keep everything.
- **Defensive restore** — if another tool re-patches `stream.write` after the hook was
  installed, releasing the hook will not stomp that patch (it warns instead).

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima interactive-manager is open-sourced software licensed under the [MIT][license]

[license-badge]: https://img.shields.io/npm/l/@visulima/interactive-manager?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/interactive-manager?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/interactive-manager
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
