# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/vis-mcp` is the Model Context Protocol server companion to `@visulima/vis` — exposes read-only vis introspection to AI agents (Claude, Cursor, Copilot) over stdio. Built on `@modelcontextprotocol/sdk`. Public surface (`src/index.ts`): `createMcpServer`, `registerAllTools`, `startMcpServer`, every tool registrar (`registerAdvisoryStatus`, `registerAudit`, `registerCacheHash`, `registerCacheWhy`, `registerDescribeProject`, `registerDescribeTemplate`, `registerFmt`, `registerGetRunLogs`, `registerLint`, `registerListProjects`, `registerListRuns`, `registerListTargets`, `registerListTemplates`), the `execVis`/`execVisJson` helpers, the `listVisJson`/`clearListCache` short-TTL list memo, the `okResponse`/`okStructuredResponse`/`errorResponse` builders, and the `isValidRunId`/`isValidTaskId`/`isSafePositional` validation guards.

## Architecture

- One file per MCP tool in `src/tools/` (`advisory-status`, `audit`, `cache-hash`, `cache-why`, `describe-project`, `describe-template`, `fmt`, `get-run-logs`, `lint`, `list-projects`, `list-runs`, `list-targets`, `list-templates`). Each module exports a `register<Name>(server, deps)` function. New tools follow the same pattern and must be added to `registerAllTools` in `server.ts`.
- `exec.ts` shells out to the `vis` binary — keep it the only place that spawns child processes. Tools should call `execVis` / `execVisJson` instead of using `node:child_process` directly. It enforces a `maxBufferBytes` ceiling (64 MiB default) so a runaway subcommand can't exhaust memory.
- `list-cache.ts` (`listVisJson`) is a short-TTL memo over `vis list` payloads — used by `describe-project`/`list-targets` so a `list_projects` → `describe_project` sequence doesn't pay the subprocess cost twice.
- `response.ts` (`okResponse`, `okStructuredResponse`, `errorResponse`) is the canonical shape for tool results — use it for every return path. Tools with a typed CLI payload register an `outputSchema` and return `okStructuredResponse` so clients get validated `structuredContent`.
- `validation.ts` (`isValidRunId`, `isValidTaskId`, `isSafePositional`) gates user-supplied identifiers. Validate at the tool boundary, never inside `exec.ts`. Any free-form positional forwarded to the CLI must be rejected when flag-shaped (`isSafePositional`) AND passed after a literal `--` separator so it can never be reinterpreted as an option.
- `bin.ts` is the published `vis-mcp` binary entry. Side-effect-free `index.ts` re-exports the API for embedding.
- `peerDependencies`: `@visulima/vis` pinned to an exact version — bump in lockstep with `vis` releases.

### Roadmap pairing

vis-mcp ships alongside a **separate Claude Skill** (declarative instructions for the agent) — the Skill is not implemented as an MCP bridge. When adding a tool here, also document its intended usage in the Skill rather than encoding workflow logic in the MCP server.

## Related

- Server for `@visulima/vis`. The MCP layer is purely a thin RPC over `vis` subcommands — it does not duplicate vis logic.
