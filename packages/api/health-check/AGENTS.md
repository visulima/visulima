# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/health-check` registers async health checks for a Node service and exposes them via two HTTP handlers: `healthCheckHandler` (full status + metrics) and `healthReadyHandler` (readiness probe). Built-in checks under `src/checks/`: `dnsCheck`, `httpCheck`, `pingCheck`, `nodeEnvCheck`. Custom checks implement the `Checker` interface from `src/types`.

## Architecture

- **`HealthCheck` class** (`src/healthcheck.ts`) is the registry — consumers call `addChecker(name, checker)` and pass the instance into a handler factory.
- **Pure ESM** — only an `import` condition is exported (no CJS build), and the `lint:attw` script runs with `--profile esm-only`.
- **No peer deps**: uses runtime deps `cacheable-lookup` (DNS), `pingman` (ping), `http-status-codes`. Handlers are framework-agnostic Node HTTP handlers — pluggable into Next.js, Connect, raw `http`.

## Related

- Lives alongside `@visulima/connect` / `@visulima/api-platform` but has no dependency on them — composable into any router.
