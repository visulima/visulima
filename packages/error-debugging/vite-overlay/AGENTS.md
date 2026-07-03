# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/vite-overlay` is a Vite plugin (default export) that replaces Vite's built-in error overlay with a richer, source-map-aware UI. It intercepts `server.ws.send` to enhance server errors, hooks an HMR `MESSAGE_TYPE` channel to receive client runtime errors, listens for `unhandledRejection`, and patches the `vite/dist/client/client.mjs` overlay element to inject a balloon button. Auto-detects React (`vite:react-swc`, `vite:react-refresh`, `vite:react-babel`, `@vitejs/plugin-react`) and Vue (`vite:vue`, `@vitejs/plugin-vue`) projects to enable framework-aware hints.

## Architecture

### Single entry point

Exports the plugin function only (`errorOverlayPlugin(options)`). Plugin uses `apply: "serve"` and `enforce: "pre"` — it never runs in build mode.

### Error pipeline

1. Errors arrive via three channels: WebSocket interception (`setupWebSocketInterception`), HMR custom message (`setupHMRHandler`, gated by `forwardConsole`), and `process.on("unhandledRejection")`.
2. `buildExtendedError` walks the cause chain (`getErrorCauses` from `@visulima/error`), enhances each frame with original source via `enhanceViteSsrError` + `server.ssrFixStacktrace`, then runs all `solutionFinders` in priority order. Built-in finders: `errorHintFinder`, `createViteSolutionFinder(rootPath)`, `ruleBasedFinder`.
3. Stack URLs are absolutized + cleaned (`absolutizeStackUrls`, `cleanErrorStack`) before being sent to the client.
4. Recent errors are deduplicated via `RECENT_ERROR_TTL_MS` keyed by `message\nstack` signature.

### Client patch

`patchOverlay(code, balloonEnabled, balloonConfig, customCSS)` rewrites Vite's overlay client. The injected `<script type="module">` (from `generateClientScript`) wires up console-method forwarding (default: `["error"]`) and the balloon UI.

### Peer deps

`vite` `^6 || ^7 || ^8` is the only peer. No optional peers — Shiki and `@shikijs/cli` (used for ANSI code-frames in `developmentLogger`) are hard runtime deps.

### Testing

Adds a Playwright e2e suite (`test:e2e`) on top of standard Vitest — see `playwright.config.ts` and `playwright-setup.js`.

## Related

- Built on `@visulima/error` (`renderError`, `getErrorCauses`, `errorHintFinder`, `ruleBasedFinder`).
- Nx implicit deps: `terminal/boxen`, `filesystem/path`, `error-debugging/error`.
- Shares the language-detection helper with `ono` via `shared/utils/find-language-based-on-extension`.
