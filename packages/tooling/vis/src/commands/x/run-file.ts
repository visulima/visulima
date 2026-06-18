import { spawnSync } from "node:child_process";

import type { RuntimeId } from "../../runtime/adapters/types";
import { prepareScriptRuntime } from "../../runtime/augment";

/**
 * Shared core for `vis x` — run a single file under a resolved runtime. Used by
 * both the lean fast-path (`lean.ts`, the common case) and the registered command
 * handler. Node runs IN-PROCESS via the oxc `registerHooks` loader (`ts-loader.ts`):
 * no second Node boot (~117ms saved) and oxc transpiles the full TS surface + JSX.
 * Bun is a separate runtime, so it is spawned.
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

    // Shared `.env` cascade + opt-in polyfills (same helper the launcher preload
    // uses, so the two `vis x` execution paths set up identically).
    await prepareScriptRuntime(cwd);

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
