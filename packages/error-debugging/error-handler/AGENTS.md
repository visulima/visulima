# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/error-handler` ships content-negotiating error handlers for HTTP servers and CLIs. The default `createNegotiatedErrorHandler` inspects the `Accept` header and dispatches to one of: HTML, JSON, JSON:API, Problem-JSON (RFC 7807), JSONP, XML, or plain text. Runtime adapters wrap the same formatters for Node `http`, Fetch-based runtimes (Hono, Bun, Cloudflare, Deno, Edge), and CLI output.

## Architecture

### Sub-path exports
- `./handler/cli` — CLI error handler.
- `./handler/http/node` — Node.js `http.IncomingMessage`/`ServerResponse` handler.
- `./handler/http/{hono,bun,cloudflare,deno,edge}` and `./handler/fetch` — all alias the same `fetch-handler.js`; choose the one that best documents intent.
- `./error-handler/{html,json,jsonapi,jsonp,problem,text,xml}` — individual formatters; each accepts an options bag and returns a handler function. Extensible via regex matching on `Accept`.

### Formatter pattern
Every formatter follows the `(error, request, response, options) => body` contract and exposes typed `*ErrorHandlerOptions`, `*ErrorBody`, and `*ErrorFormatter` types. Add new content types by writing a new formatter file under `src/error-handler/` and re-exporting from `src/index.ts`; wire it into `createNegotiatedErrorHandler` via the `ErrorHandlers` map.

### Dependencies
Hard runtime deps: `@tinyhttp/accepts` (content negotiation), `@visulima/boxen` (HTML output), `@visulima/error` (error rendering), `http-errors`, `http-status-codes`, `jstoxml`, `ts-japi` (JSON:API serialization). No peer deps — works with any framework that exposes Node or Fetch primitives.

## Related

- Built on `@visulima/error` (`renderError`, `getErrorCauses`) and `@visulima/boxen`.
- Consumed by Node/Express/Fastify/Hono/Bun apps that need RFC 7807 / JSON:API compliance out of the box.
