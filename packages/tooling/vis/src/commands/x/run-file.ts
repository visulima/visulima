import { spawnSync } from "node:child_process";

import type { RuntimeId } from "../../runtime/adapters/types";
import { loadEnvFile } from "../../task/target-options";

/**
 * Shared core for `vis x` — run a single file under a resolved runtime. Used by
 * both the lean fast-path (`lean.ts`, the common case) and the registered
 * command handler. Node runs IN-PROCESS via jiti: no second Node boot (~117ms
 * saved) and jiti transpiles the full TS surface + JSX, with its own on-disk
 * transpile cache. Bun is a separate runtime, so it is spawned.
 */

/** Run `file` under Bun, which transpiles TS/JSX natively. */
const runUnderBun = (file: string, scriptArguments: string[], cwd: string): number => {
    const result = spawnSync("bun", ["run", file, ...scriptArguments], { cwd, stdio: "inherit" });

    if (result.error) {
        if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
            throw new Error("Runtime is set to bun but the `bun` binary is not on PATH. Install it from https://bun.sh.");
        }

        throw result.error;
    }

    return result.status ?? (result.signal === null ? 0 : 1);
};

/** Run `file` in-process under Node, transpiling TS/JSX via vis-native's oxc loader. */
const runUnderNode = async (file: string, scriptArguments: string[], cwd: string): Promise<number> => {
    const { importTs } = await import("../../runtime/ts-loader");

    // Auto-load the .env cascade from cwd (matches nub's file-runner and Bun's
    // own behaviour). Real environment variables win over .env values — the
    // dotenv convention — so this never clobbers an explicitly-set var.
    for (const [key, value] of Object.entries(loadEnvFile(cwd, true))) {
        if (process.env[key] === undefined) {
            process.env[key] = value;
        }
    }

    // Optional runtime augmentation: feature-detected polyfills (Temporal,
    // URLPattern) for the user script, when VIS_POLYFILL is set. Mirrors the
    // launcher preload path so polyfills work with or without the Rust launcher.
    if (process.env["VIS_POLYFILL"] !== undefined) {
        const { installPolyfills } = await import("../../runtime/polyfills");

        await installPolyfills(process.env["VIS_POLYFILL"], cwd);
    }

    // The script must observe its own argv (argv[0]=node, argv[1]=file, then its
    // args), not vis's. Restored afterwards so a caught error still reports cleanly.
    const savedArgv = process.argv;

    process.argv = [process.execPath, file, ...scriptArguments];

    try {
        await importTs(file);
    } finally {
        process.argv = savedArgv;
    }

    return typeof process.exitCode === "number" ? process.exitCode : 0;
};

export const runFile = async (file: string, scriptArguments: string[], runtime: RuntimeId, cwd: string): Promise<number> =>
    (runtime === "bun" ? runUnderBun(file, scriptArguments, cwd) : runUnderNode(file, scriptArguments, cwd));
