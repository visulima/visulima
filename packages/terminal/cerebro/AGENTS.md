# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/cerebro` is the cross-runtime CLI framework that other Visulima tools (notably `@visulima/vis`) are built on. The main class lives in `src/cli.ts` and is exported as both `Cerebro` and the `createCerebro(name, options)` factory from `src/index.ts`. Subcommands, plugins, argument parsing (via `@visulima/command-line-args`), help, version, completion, and update-notifier are wired together through `src/plugin-manager.ts` and `src/commands/`.

## Architecture

### Toolbox dependency injection (v5 alpha — load-bearing)

As of commit `7d8ab0a3e`, the `Toolbox` passed to every command `execute({ ... })` ships injectable runtime adapters. **New and refactored command handlers MUST consume these from the toolbox rather than importing `node:fs`, `node:fs/promises`, or `node:process` directly** — this is the foundation for MCP, sandboxed, and test runtimes.

- `toolbox.fs: CerebroFs` — a subset of `node:fs/promises` (`access`, `mkdir`, `readdir`, `readFile`, `rm`, `stat`, `writeFile`). Defaults to a wrapper around `node:fs/promises`, overridable via `CliOptions.fs`. See `src/types/runtime.ts`.
- `toolbox.process: CerebroProcess` — snapshot of `cwd`, `env`, `argv`, `platform`, `arch`, `stdin` plus an `exit(code)` function. `exit` honors `CliOptions.exit`, which lets tests assert exit codes without killing the runner.
- `toolbox.console: TLogger` — alias of `toolbox.logger`. Prefer `({ console }) => console.log(...)` in commands over the global `console` so verbosity-aware methods (`debug`) and test loggers keep working.
- `toolbox.rawUnknown: ReadonlyArray<string>` — tokens after `--`, since the parser runs with `stopAtFirstUnknown: true`. Use for passthrough patterns (`my-cmd vite my-app -- --template react-ts`).

Companion APIs on `Cli` (also new in v5 alpha):

- `cli.clone(overrides?)` — returns a new `Cli` that shares command/option/path registrations but applies the override `CliOptions`. The primary use case is tests and embedded runtimes that need an isolated `exit`/`fs`/`argv` without mutating the original instance.
- `cli.getAction(commandName)` — returns the resolved `CommandExecute` for a registered command, lazy-loaders included. Useful for MCP bridges and for invoking a command's action programmatically without going through argv parsing.

### Type-safe toolbox extensions

`declare global { namespace Cerebro { interface ExtensionOverrides { ... } } }` in `src/index.ts` lets plugins add type-safe properties to the toolbox (see the JSDoc example there). When adding a new plugin that injects properties, declare the shape via `ExtensionOverrides` so user commands get autocomplete.

### Optional peer dependencies

`@visulima/boxen`, `@visulima/pail`, `@visulima/find-cache-dir`, `@bomb.sh/tab`, and `github-slugger` are **optional peers**. Code paths that touch them must be lazy/guarded — do not import them at the top of a hot-path module that runs without those features installed. The corresponding subpath exports (`./command/help`, `./logger/pail`, `./plugins/update-notifier`, `./command/completion`, `./command/readme-generator`) live behind opt-in deep imports for this reason.

### Plugins and lifecycle

Plugins implement the `Plugin` interface (`src/types/plugin.ts`) and are registered via `cli.addPlugin(plugin)` / `cli.use(plugin)`. The PluginManager (`src/plugin-manager.ts`) coordinates `beforeRun`, `afterRun`, `onError`, and command-mutation hooks. Built-in plugins live in `src/plugins/` (error-handler, runtime-version-check, update-notifier).

## Related

- Foundation for `@visulima/vis` (the meta-CLI). See `packages/tooling/vis/` — its command handlers are the canonical reference for the toolbox injection pattern.
- Roadmap item #5 calls for an MCP server + Claude Skill on top of cerebro; the injectable toolbox is the substrate.
