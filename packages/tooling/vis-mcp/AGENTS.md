# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/vis-mcp` is the Model Context Protocol server companion to `@visulima/vis` — exposes read-only vis introspection to AI agents (Claude, Cursor, Copilot) over stdio. Built on `@modelcontextprotocol/sdk`. Public surface (`src/index.ts`): `createMcpServer`, `registerAllTools`, `startMcpServer`, individual tool registrars (`registerCacheHash`, `registerCacheWhy`, `registerDescribeProject`, `registerGetRunLogs`, `registerListProjects`, `registerListTargets`), plus `execVis`/`execVisJson` helpers and `okResponse`/`errorResponse` builders.

## Architecture

- One file per MCP tool in `src/tools/` (`advisory-status`, `audit`, `cache-hash`, `cache-why`, `describe-project`, `describe-template`, `get-run-logs`, `list-projects`, `list-targets`, `list-templates`). Each module exports a `register<Name>(server, deps)` function. New tools follow the same pattern and must be added to `registerAllTools` in `server.ts`.
- `exec.ts` shells out to the `vis` binary — keep it the only place that spawns child processes. Tools should call `execVis` / `execVisJson` instead of using `node:child_process` directly.
- `response.ts` (`okResponse`, `errorResponse`) is the canonical shape for tool results — use it for every return path.
- `validation.ts` (`isValidRunId`, `isValidTaskId`) gates user-supplied identifiers. Validate at the tool boundary, never inside `exec.ts`.
- `bin.ts` is the published `vis-mcp` binary entry. Side-effect-free `index.ts` re-exports the API for embedding.
- `peerDependencies`: `@visulima/vis` pinned to an exact version — bump in lockstep with `vis` releases.

### Roadmap pairing

vis-mcp ships alongside a **separate Claude Skill** (declarative instructions for the agent) — the Skill is not implemented as an MCP bridge. When adding a tool here, also document its intended usage in the Skill rather than encoding workflow logic in the MCP server.

## Related

- Server for `@visulima/vis`. The MCP layer is purely a thin RPC over `vis` subcommands — it does not duplicate vis logic.
