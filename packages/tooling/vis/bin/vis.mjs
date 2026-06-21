#!/usr/bin/env node
// Native front-end launcher for `vis`.
//
// This is the npm `bin` entry. Its only jobs are to (1) route the small set of
// natively-implemented commands to the platform Rust binary, and (2) fall
// through to the existing in-process Node CLI for everything else. The
// fall-through path is byte-identical to running `dist/bin.js` directly, so the
// launcher adds no extra Node boot for delegated commands — it `import()`s the
// same entry in the same process.
//
// As commands are ported off Node, their names are added to NATIVE_COMMANDS and
// the binary grows to handle them; the binary itself delegates anything it does
// not implement back to `dist/bin.js` via the VIS_* contract.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { constants } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { resolveNativeBinary } from "./resolve-binary.mjs";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// VIS_FALLBACK_ENTRY lets tests (and the native binary's own delegation) point
// the Node entry elsewhere; production resolves it next to the package.
const fallbackEntry = process.env.VIS_FALLBACK_ENTRY ?? join(packageRoot, "dist", "bin.js");

// Commands answered by the native binary. Every entry here MUST be handled by
// the binary (natively or via its own Node delegation), with VERIFIED parity to
// the Node behavior. Unknown commands never reach the binary — they take the
// in-process path below, unchanged. NOTE: `-v` is cerebro's verbose flag (not
// version), so it is deliberately absent.
//
// `exec` is implemented natively (main.rs/exec.rs) and unit-tested, but is NOT
// routed here yet: its flag handling vs cerebro's `stopAtFirstUnknown` parsing
// needs verification against a real build before we can claim parity. Until
// then it falls through to the Node lean path, unchanged.
const NATIVE_COMMANDS = new Set(["--version", "-V", "__native-info", "__pm-shim"]);

const command = process.argv[2] ?? "";

if (NATIVE_COMMANDS.has(command)) {
    const binary = resolveNativeBinary(packageRoot);

    if (binary !== undefined) {
        const { version } = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));

        const { error, signal, status } = spawnSync(binary, process.argv.slice(2), {
            env: {
                ...process.env,
                VIS_FALLBACK_ENTRY: fallbackEntry,
                VIS_NODE: process.execPath,
                VIS_VERSION: version,
            },
            stdio: "inherit",
        });

        if (error) {
            // Binary unusable (e.g. corrupt install) — fall through to Node.
            process.env.VIS_NATIVE_BIN_FAILED = "1";
        } else if (signal) {
            // Signal-terminated: follow the shell convention (128 + signal number)
            // so the exit code matches the binary's own delegation path.
            process.exit(128 + (constants.signals[signal] ?? 1));
        } else {
            process.exit(status ?? 1);
        }
    }
    // No binary for this platform: fall through to the Node CLI below.
}

// In-process Node CLI. Same module graph and behaviour as invoking dist/bin.js
// directly — no extra process boot. fallbackEntry is an internally-resolved path
// (never user input); pathToFileURL keeps the dynamic import valid on Windows.
// eslint-disable-next-line no-unsanitized/method -- fallbackEntry is resolved internally, not from user input
await import(pathToFileURL(fallbackEntry).href);
