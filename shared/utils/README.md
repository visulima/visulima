# @shared/utils

> Private, source-only helper library shared by the Visulima error-debugging packages
> (`@visulima/error-handler`, `@visulima/ono`, `@visulima/vite-overlay`).

This package is **not published**. It is consumed directly from source via the
workspace name `@shared/utils` (or, historically, via deep relative paths). It
collects the small building blocks used to render rich error output: CLI error
formatting, Shiki syntax highlighting, language detection from file extensions,
and an editor enum for "open in editor" links.

## Modules

| Module | Default export | Named exports |
| --- | --- | --- |
| `cli-error-builder` | — | `buildOutput`, `terminalOutput`, types `BaseCliOptions` / `CliHandlerOptions` |
| `editors` | `Editors` enum | — |
| `find-language-based-on-extension` | `findLanguageBasedOnExtension` | — |
| `get-file-source` | `getFileSource` | `clearFileSourceCache`, type `GetFileSourceOptions` |
| `get-highlighter` | `getHighlighter` | `disposeHighlighter`, `transformerCompactLineOptions` |
| `get-language-import` | `getLanguageImport` | `LANGUAGE_IMPORT_MAP` |

A barrel `index.ts` re-exports everything, so consumers can also do:

```ts
import { findLanguageBasedOnExtension, getFileSource } from "@shared/utils";
```

## Notable behaviour

### `getFileSource(file, options?)`

Reads the source for a stack-frame path. It understands:

- `file:` URLs (read from disk),
- **plain absolute filesystem paths** (`/home/user/app/index.js`) — common in
  CommonJS and many V8 stack traces,
- `http(s):` / `data:` URLs — but **only** when `options.allowRemote` is set.

Remote fetching is opt-in because `error.stack` is just a string that can be
influenced by untrusted input; fetching arbitrary URLs server-side would be an
SSRF surface. The in-memory cache is a bounded LRU (max 50 entries) so it stays
flat in long-running dev servers. Call `clearFileSourceCache()` to reset it.

### `findLanguageBasedOnExtension(file)`

Maps a file extension to a Shiki language id. Covers web languages plus common
polyglot/monorepo languages (`yaml`, `toml`, `python`, `go`, `rust`, `ruby`,
`php`, `graphql`, `dockerfile`, …). Unknown extensions fall back to `"text"`
(no highlighting) rather than mis-colouring as JavaScript.

### `buildOutput` / `terminalOutput` (`cli-error-builder`)

`terminalOutput` renders an error plus an optional solution box to a logger
(defaults to `console`). Setting `debug: true` logs which solution finder ran
and which one matched via the injected logger.

## Tests

```bash
pnpm --filter "@shared/utils" exec vitest run
```
