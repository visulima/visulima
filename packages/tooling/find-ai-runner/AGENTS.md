# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/find-ai-runner` detects and invokes AI CLI tools installed on the host (Claude, Gemini, Codex, Copilot, Cursor, Crush, Amp, Kimi, Qwen, OpenCode, Droid). Public surface: `detectProvider`, `detectAllProviders`, `detectAllProvidersAsync`, `detectAvailableProviders`, `findRunner`, `buildCliArgs`, `runProvider`, `AiRunError`, `PROVIDERS`, `PROVIDER_NAMES` (see `src/index.ts`). Ships a small CLI (`bin: find-ai-runner` -> `dist/cli.js`).

## Architecture

- One file per provider under `src/providers/`. Adding a new AI CLI means: drop a new `<name>.ts` that exports an `AiProviderConfig`, register it in the `PROVIDERS` map in `src/index.ts`, and add the name to `PROVIDER_NAMES` in `src/constants.ts`.
- Detection order is fixed: env var (e.g., `CLAUDE_PATH`) -> `which`/`where` -> platform-specific known paths (`/opt/homebrew/bin`, `~/.local/bin`, `~/.cargo/bin`, `%APPDATA%\npm`, etc.). Don't reorder these without updating tests.
- `runProvider` spawns with `NO_COLOR=1` / `FORCE_COLOR=0` and closes stdin immediately. It is non-interactive by design — don't add prompts. Supports `cwd`/`env`/`signal`/`onStdout`/`onStderr`; rejects with `AiRunError` (carrying partial output + exit metadata). On Windows it runs `.cmd`/`.bat` shims via `shell: true` with self-quoted args (CVE-2024-27980 EINVAL fix).
- Per-provider `buildArgs(prompt, { dangerous, model, maxTokens })` builds the CLI invocation. Permission-bypass flags (`--yolo`, `--dangerously-skip-permissions`, …) are gated behind `dangerous` (opt-in, default off). Each config declares `supportsModel`/`supportsMaxTokens`. Default model lives on the provider config; callers can override via `AiRunOptions`.
