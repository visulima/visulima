# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/find-ai-runner` detects and invokes AI CLI tools installed on the host (Claude, Gemini, Codex, Copilot, Cursor, Crush, Amp, Kimi, Qwen, OpenCode, Droid). Public surface: `detectProvider`, `detectAllProviders`, `detectAllProvidersAsync`, `detectAvailableProviders`, `findRunner`, `buildCliArgs`, `runProvider`, `AiRunError`, `PROVIDERS`, `PROVIDER_NAMES` (see `src/index.ts`). Ships a small CLI (`bin: find-ai-runner` -> `dist/cli.js`).

## Architecture

- One file per provider under `src/providers/`. Adding a new AI CLI means: drop a new `<name>.ts` that exports an `AiProviderConfig`, register it in the `PROVIDERS` map in `src/index.ts`, and add the name to `PROVIDER_NAMES` in `src/constants.ts`.
- Detection order is fixed: env var (e.g., `CLAUDE_PATH`) -> `which`/`where` -> platform-specific known paths (`/opt/homebrew/bin`, `~/.local/bin`, `~/.cargo/bin`, `%APPDATA%\npm`, etc.). Don't reorder these without updating tests.
- `runProvider` spawns with `NO_COLOR=1` / `FORCE_COLOR=0` and closes stdin immediately. It is non-interactive by design — don't add prompts. Supports `cwd`/`env`/`signal`/`onStdout`/`onStderr`; rejects with `AiRunError` (carrying partial output + exit metadata).
- **Windows shims avoid `cmd.exe` wherever possible.** `planInvocation` (`src/index.ts`) resolves a `.cmd`/`.bat` shim to the script it wraps via `resolveWindowsShimTarget` (`src/windows-shim.ts`) and spawns `<interpreter> <script>` with a plain argv array. `resolveShimInterpreter` picks that interpreter the way `cmd-shim` does — a `node.exe` next to the shim if there is one, otherwise `node` from PATH. Not `process.execPath`: under an Electron host that is the app binary, and it ignores the Node the shim was installed against. This is a security requirement, not a convenience: a `cmd.exe` command line has **no escape for `%`**, so `%VAR%` anywhere in a prompt is replaced with an environment value before the CLI sees it, and quoting does not help (the same gap exists in `cross-spawn`). Only shims that don't match the `cmd-shim` layout fall back to `shell: true` with self-quoted args (CVE-2024-27980 EINVAL fix) — and that fallback still carries the `%` hole. Don't reintroduce the shell on the common path.
- Per-provider `buildArgs(prompt, { dangerous, model, maxTokens })` builds the CLI invocation. Permission-bypass flags (`--yolo`, `--dangerously-skip-permissions`, …) are gated behind `dangerous` (opt-in, default off). Each config declares `supportsModel`/`supportsMaxTokens`. Default model lives on the provider config; callers can override via `AiRunOptions`.
