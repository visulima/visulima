# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/fs` is a human-friendly Node.js filesystem toolkit: walk/glob, find-up, ensure-dir/file/link/symlink, read/write JSON, move/rename, EOL detection, sanitisation, plus pluggable parsers for YAML/TOML/JSONC/JSON5/INI behind subpath exports.

## Architecture

### Subpath exports

The package ships one entry per concern — import from the narrowest subpath you need so optional peers stay tree-shaken:

- `@visulima/fs` — core fs surface (walk, glob, findUp, ensure*, read/writeFile, read/writeJson, move, remove, emptyDir, isAccessible, sanitize, EOL).
- `@visulima/fs/error` — `NotFoundError`, `AlreadyExistsError`, etc.
- `@visulima/fs/yaml` | `/toml` | `/jsonc` | `/json5` | `/ini` — parser-backed read/write helpers. Each requires its peer dep to be installed.
- `@visulima/fs/size` — file/dir size helpers.
- `@visulima/fs/eol` — EOL constants and conversion.
- `@visulima/fs/glob`, `/glob-parent`, `/is-glob`, `/match` — glob primitives wrapping `tinyglobby` / `picomatch`.
- `@visulima/fs/utils` — internal helpers re-exported for power users.

### Optional peer dependencies

`ini`, `json5`, `jsonc-parser`, `smol-toml`, and `yaml` are declared as **optional** peers (`peerDependenciesMeta`). Calling `@visulima/fs/yaml` etc. without the matching peer installed will throw at runtime — never import these subpaths from core code that consumers don't already opt into.

### Internal layout

Code is grouped by verb: `src/ensure/`, `src/find/` (walk, findUp, glob, collect), `src/move/`, `src/read/`, `src/remove/`, `src/write/`, plus standalone modules (`is-accessible`, `match`, `sanitize`, `eol`, format-specific files). Most operations come in async + `*Sync` pairs — keep both in sync when changing behaviour.

### Formatter gotcha

Package-wide `prettier:fix` has previously caused eslint regressions elsewhere. After scripted edits, scope prettier/eslint `--fix` to the files you actually touched.

## Related

- `@visulima/path` — used internally for all path math (see its AGENTS.md for the `sep` gotcha).
- `@visulima/find-cache-dir` — consumer of `findUp` / `isAccessible`.
