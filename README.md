<p align="center">
  <a href="https://visulima.com">
    <img src="./.github/assets/visulima_logo.svg" width="200" />
    <h1 align="center">Visulima</h1>
  </a>
</p>

<p align="center">
  <strong>The TypeScript toolbox for building modern Node.js, browser, edge, and CLI applications.</strong>
</p>

<p align="center">
  44+ independent, production-ready packages. Pick only what you need.
</p>

<div align="center">

[![typescript-image][typescript-badge]][typescript-url]
[![mit licence][license-badge]][license]
[![Chat][chat-badge]][chat]
[![PRs Welcome][prs-welcome-badge]][prs-welcome]

</div>

---

<div align="center">
    <p>
        <sup>
            Daniel Bannert's open source work is supported by the community on <a href="https://github.com/sponsors/prisis">GitHub Sponsors</a>
        </sup>
    </p>
</div>

---

## What is Visulima?

Visulima is a curated collection of small, focused TypeScript libraries that solve the problems you hit every day when shipping real applications. Things like parsing CLI args, formatting terminal output, handling files and paths, debugging errors with readable stack traces, building APIs, sending emails, redacting secrets, and dozens more.

Every package is **standalone**. Install one, install ten, mix them with whatever framework you already use. No lock-in, no umbrella runtime.

## Why Visulima?

- **Modular by design.** Every package has a single responsibility and ships independently. Use `@visulima/fs` without touching anything else.
- **Modern runtimes.** Pure ESM that works in Node.js, Bun, Deno, edge runtimes, and (where it makes sense) the browser.
- **TypeScript-native.** Written in TypeScript with strict types, full inference, and `"sideEffects": false` for clean tree-shaking.
- **Production-tested.** High test coverage, Vitest-driven, used in real products.
- **Well-documented.** Every package has a dedicated doc page on [visulima.com](https://visulima.com), plus a README with examples and API reference.
- **MIT licensed.** Free to use, free to fork.

## Drop-in replacements

Already using one of these? Swap it out without changing your code:

| You're using                                 | Try                                                          | What you get                                                      |
| -------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| `node:path`                                  | [`@visulima/path`](packages/filesystem/path/README.md)       | Same API, normalized paths, smaller and faster.                   |
| [`chalk`](https://github.com/chalk/chalk)    | [`@visulima/colorize`](packages/terminal/colorize/README.md) | Chalk-compatible API, up to **3× faster**, with nested templates. |
| [`ink`](https://github.com/vadimdemedes/ink) | [`@visulima/tui`](packages/terminal/tui/README.md)           | Ink-compatible React API, backed by a native Rust diff engine.    |

## Powered by native Rust

Performance-critical packages ship with NAPI bindings and a JS fallback. Fast where it matters, portable everywhere.

- **[`@visulima/tui`](packages/terminal/tui/README.md)** uses a native Rust diff engine for the React-to-terminal renderer.
- **[`@visulima/secret-scanner`](packages/tooling/secret-scanner/README.md)** is a Rust port of gitleaks detection, exposed via NAPI.
- **[`@visulima/task-runner`](packages/tooling/task-runner/README.md)** runs concurrent processes with native Rust performance and process-tree cleanup on every OS.

## Install

Install only the packages you need:

```bash
# pnpm
pnpm add @visulima/pail @visulima/fs

# npm
npm install @visulima/pail @visulima/fs

# yarn
yarn add @visulima/pail @visulima/fs
```

Every package has a dedicated doc page on **[visulima.com](https://visulima.com)** with usage examples and full API reference.

## What's inside

Packages are grouped into eight categories. Jump to the section you need:

- **[API](#api)**: routing, CRUD, OpenAPI, pagination, health checks
- **[Data Manipulation](#data-manipulation)**: strings, objects, bytes, HTML, redaction, locales
- **[Email](#email)**: multi-provider sending, templates, disposable-domain detection
- **[Error Debugging](#error-debugging)**: stack traces, source maps, loggers, dev overlays
- **[Filesystem](#filesystem)**: human-friendly fs helpers, path utilities, cache directories
- **[Storage](#storage)**: S3, Azure, GCS, and local file uploads with a unified API
- **[Terminal](#terminal)**: CLIs, colors, spinners, progress bars, tables, TUI
- **[Tooling](#tooling)**: task runner, secret scanner, tsconfig parser, package utilities

## All Packages

<!-- START_TABLE_PLACEHOLDER -->
### API

| Package | Version | Description |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@visulima/health-check](packages/api/health-check/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fhealth-check?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fhealth-check) | A library built to provide support for defining service health for node services. It allows you to register async health checks for your dependencies and the service itself, provides a health endpoint that exposes their status, and health metrics. |
| [@visulima/jsdoc-open-api](packages/api/jsdoc-open-api/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fjsdoc-open-api?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fjsdoc-open-api) | Generates swagger doc based on JSDoc. |
| [@visulima/pagination](packages/api/pagination/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fpagination?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fpagination) | Simple Pagination for Node. |

### Data Manipulation

| Package | Version | Description |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@visulima/bytes](packages/data-manipulation/bytes/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fbytes?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fbytes) | Utility functions to make dealing with Uint8Arrays easier |
| [@visulima/content-safety](packages/data-manipulation/content-safety/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fcontent-safety?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fcontent-safety) | Content safety filtering with multi-language banned word detection. Supports 19 languages with word-boundary matching, match position reporting, and both browser and server runtime compatibility. |
| [@visulima/deep-clone](packages/data-manipulation/deep-clone/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fdeep-clone?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fdeep-clone) | Fastest deep clone implementation. |
| [@visulima/html](packages/data-manipulation/html/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fhtml?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fhtml) | Functions for HTML, such as escaping or unescaping HTML entities |
| [@visulima/humanizer](packages/data-manipulation/humanizer/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fhumanizer?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fhumanizer) | Humanizer is a library for humanizing data in a human-readable form. |
| [@visulima/iso-locale](packages/data-manipulation/iso-locale/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fiso-locale?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fiso-locale) | ISO data for countries, currencies, regions, timezones, and BCP 47 locale support. |
| [@visulima/object](packages/data-manipulation/object/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fobject?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fobject) | Helper functions for working with objects and arrays. |
| [@visulima/redact](packages/data-manipulation/redact/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fredact?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fredact) | A library for redacting and masking sensitive data from objects and strings, with support for GDPR compliance, custom rules, and deep object traversal. |
| [@visulima/string](packages/data-manipulation/string/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fstring?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fstring) | Functions for manipulating strings. |

### Email

| Package | Version | Description |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@visulima/disposable-email-domains](packages/email/disposable-email-domains/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fdisposable-email-domains?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fdisposable-email-domains) | A regularly updated list of disposable and temporary email domains. |
| [@visulima/email](packages/email/email/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Femail?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Femail) | A comprehensive email library with multi-provider support, crypto utilities, and template engines |
| [@visulima/email-provider-mx](packages/email/email-provider-mx/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Femail-provider-mx?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Femail-provider-mx) | Classify the email provider (mailbox host or secure email gateway) behind an MX record. |
| [@visulima/email-verifier](packages/email/email-verifier/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Femail-verifier?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Femail-verifier) | Mailer-free email address verification and enrichment: syntax, MX/SMTP probing, disposable/free/role detection, catch-all, provider & secure-email-gateway classification, typo suggestions, and a 0–100 quality score. |
| [@visulima/free-email-domains](packages/email/free-email-domains/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Ffree-email-domains?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Ffree-email-domains) | A regularly updated list of free email service provider domains. |

### Error Debugging

| Package | Version | Description |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@visulima/dev-toolbar](packages/error-debugging/dev-toolbar/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fdev-toolbar?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fdev-toolbar) | Devtools is a set of tools for building advanced devtools for your application |
| [@visulima/error](packages/error-debugging/error/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Ferror?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Ferror) | Error with more than just a message, stacktrace parsing. |
| [@visulima/error-handler](packages/error-debugging/error-handler/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Ferror-handler?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Ferror-handler) | Error handlers for use in development and production environments. |
| [@visulima/inspector](packages/error-debugging/inspector/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Finspector?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Finspector) | Inspect utility for Node.js and Browsers. |
| [@visulima/ono](packages/error-debugging/ono/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fono?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fono) | Ono is an error-parsing library that pretty prints JavaScript errors on a web page or the terminal. |
| [@visulima/pail](packages/error-debugging/pail/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fpail?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fpail) | Highly configurable Logger for Node.js, Edge and Browser. |
| [@visulima/source-map](packages/error-debugging/source-map/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fsource-map?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fsource-map) | Provides functionality related to source maps. |
| [@visulima/vite-overlay](packages/error-debugging/vite-overlay/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fvite-overlay?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fvite-overlay) | Improved vite overlay |

### Filesystem

| Package | Version | Description |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@visulima/find-cache-dir](packages/filesystem/find-cache-dir/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Ffind-cache-dir?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Ffind-cache-dir) | Finds the common standard cache directory |
| [@visulima/fs](packages/filesystem/fs/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Ffs?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Ffs) | Human friendly file system utilities for Node.js |
| [@visulima/path](packages/filesystem/path/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fpath?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fpath) | Drop-in replacement of the Node.js path module. |

### Notification

| Package | Version | Description |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@visulima/notification](packages/notification/notification/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fnotification?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fnotification) | A reusable, ESM-only, edge-ready multi-channel notification library with SMS, push, chat, in-app and webhook providers |

### Storage

| Package | Version | Description |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@visulima/storage](packages/storage/storage/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fstorage?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fstorage) | Server-side file-storage abstraction - store files in a web-accessible location via a simplified API. Includes S3, Azure, GCS, local filesystem and 20+ other backends with TUS/multipart/REST upload handlers and the most convenient features of each. |
| [@visulima/storage-client](packages/storage/storage-client/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fstorage-client?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fstorage-client) | The upload client library. Simple and easy file uploads for React \| Vue \| Solid \| Svelte. |

### Terminal

| Package | Version | Description |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@visulima/ansi](packages/terminal/ansi/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fansi?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fansi) | ANSI escape codes for some terminal swag. |
| [@visulima/boxen](packages/terminal/boxen/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fboxen?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fboxen) | Create beautiful boxes in the terminal with customizable borders, padding, and alignment. |
| [@visulima/cerebro](packages/terminal/cerebro/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fcerebro?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fcerebro) | A delightful toolkit for building cross-runtime CLIs for Node.js, Deno, and Bun. |
| [@visulima/colorize](packages/terminal/colorize/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fcolorize?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fcolorize) | Terminal and Console string styling done right. |
| [@visulima/command-line-args](packages/terminal/command-line-args/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fcommand-line-args?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fcommand-line-args) | A mature, feature-complete library to parse command-line options. |
| [@visulima/fmt](packages/terminal/fmt/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Ffmt?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Ffmt) | Util.format-like string formatting utility. |
| [@visulima/interactive-manager](packages/terminal/interactive-manager/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Finteractive-manager?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Finteractive-manager) | Interactive terminal output manager for spinners, progress bars, and dynamic updates |
| [@visulima/is-ansi-color-supported](packages/terminal/is-ansi-color-supported/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fis-ansi-color-supported?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fis-ansi-color-supported) | Detect whether a terminal or browser supports ansi colors. |
| [@visulima/progress-bar](packages/terminal/progress-bar/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fprogress-bar?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fprogress-bar) | Terminal progress bars with multiple styles and multi-bar support |
| [@visulima/spinner](packages/terminal/spinner/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fspinner?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fspinner) | Minimal terminal spinners |
| [@visulima/tabular](packages/terminal/tabular/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Ftabular?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Ftabular) | Create beautiful ASCII tables and grids with customizable borders, padding, and alignment. Supports Unicode, colors, and ANSI escape codes. |
| [@visulima/tui](packages/terminal/tui/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Ftui?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Ftui) | React-based TUI library powered by a native Rust diff engine, drop-in Ink-compatible API |

### Tooling

| Package | Version | Description |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@visulima/find-ai-runner](packages/tooling/find-ai-runner/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Ffind-ai-runner?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Ffind-ai-runner) | Detect and invoke AI CLI tools (Claude, Gemini, Codex, Copilot, Cursor, Crush, Amp, Kimi, Qwen, OpenCode, Droid) installed on the system |
| [@visulima/package](packages/tooling/package/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fpackage?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fpackage) | A comprehensive package management utility that helps you find root directories, monorepos, package managers, and parse package.json, package.yaml, and package.json5 files with advanced features like catalog resolution. |
| [@visulima/secret-scanner](packages/tooling/secret-scanner/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fsecret-scanner?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fsecret-scanner) | Fast secret and credential scanner — a Rust port of gitleaks detection, exposed via NAPI |
| [@visulima/task-runner](packages/tooling/task-runner/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Ftask-runner?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Ftask-runner) | A task runner with caching support for monorepo workspaces |
| [@visulima/task-runner-client](packages/tooling/task-runner-client/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Ftask-runner-client?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Ftask-runner-client) | Zero-dependency client for giving the @visulima/task-runner precise cache-correctness hints from inside a task |
| [@visulima/tsconfig](packages/tooling/tsconfig/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Ftsconfig?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Ftsconfig) | Find and/or parse the tsconfig.json file from a directory path. |
| [@visulima/vis](packages/tooling/vis/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fvis?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fvis) | A monorepo dev toolkit — task runner, remote caching, security scanning, git hooks, and AI agent integrations — powered by @visulima/task-runner |
| [@visulima/vis-mcp](packages/tooling/vis-mcp/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fvis-mcp?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fvis-mcp) | MCP (Model Context Protocol) server for @visulima/vis — exposes vis tooling to AI agents over stdio |

### Workflow

| Package | Version | Description |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@visulima/workflow](packages/workflow/workflow/README.md) | [![npm](https://img.shields.io/npm/v/%40visulima%2Fworkflow?style=flat-square&labelColor=292a44&color=663399&label=v)](https://www.npmjs.com/package/%40visulima%2Fworkflow) | A reusable, ESM-only, edge-ready durable workflow engine: code-first workflows with resumable steps, delays and external-event waits, backed by a pluggable store |
<!-- END_TABLE_PLACEHOLDER -->

## Getting Started

Visit <a aria-label="visulima learn" href="https://visulima.com/learn"> https://visulima.com/learn </a> to get started with Visulima.

## Documentation

Visit [https://visulima.com/docs](https://visulima.com/docs) to view the full documentation.

## Community

The Visulima community can be found on [GitHub Discussions](https://github.com/visulima/visulima/discussions), where you can ask questions, voice ideas, and share your projects.

To chat with other community members you can join the [Visulima Discord](https://chat.visulima.com).

Our [Code of Conduct](https://github.com/visulima/visulima/blob/main/.github/CODE_OF_CONDUCT.md) applies to all Visulima community channels.

## Contributing

Please see our [contributing.md](https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md).

### Good First Issues

We have a list of [good first issues](https://github.com/visulima/visulima/labels/good%20first%20issue) that contain bugs that have a relatively limited scope. This is a great place to get started, gain experience, and get familiar with our contribution process.

---

<div align="center">
  <p>
    <sub>Built with ❤️ by</sub>
  </p>
  <p>
    <a href="https://anolilab.com">
      <img src="./.github/assets/anolilab.svg" alt="Anolilab" width="400" />
    </a>
  </p>
</div>

<!-- badges -->

[license-badge]: https://img.shields.io/badge/LICENSE-MIT-green?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
