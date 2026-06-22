import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

import { dirname, join } from "@visulima/path";

import type { RuntimeId } from "../../runtime/adapters/types";
import { prepareScriptRuntime } from "../../runtime/augment";
import { pnpNodeArgs } from "../../runtime/pnp";
import { unflagArgs } from "../../runtime/unflag";

/**
 * Shared core for `vis x` — run a single file under a resolved runtime. Used by
 * both the lean fast-path (`lean.ts`, the common case) and the registered command
 * handler. Node normally runs IN-PROCESS via the oxc `registerHooks` loader
 * (`ts-loader.ts`): no second Node boot (~117ms saved) and oxc transpiles the full
 * TS surface + JSX. Bun is a separate runtime, so it is spawned.
 *
 * Runtime augmentation (opt-in) — re-homed from the dropped Rust launcher:
 *   - `VIS_UNFLAG` / Yarn PnP need Node *start* flags, which can't be applied to an
 *     already-running process, so when either is in play `vis x` RE-EXECS Node with
 *     the flags (the same pattern cerebro's heap tuning uses) and the re-run takes
 *     the in-process path. One extra Node boot — the cost of having no native binary.
 *   - `VIS_AUGMENT_SUBPROCESS` propagates the loader + flags to nested `node` the
 *     script spawns, via `NODE_OPTIONS=--import &lt;preload>`.
 *   - `VIS_POLYFILL` polyfills run in-process (no flags needed).
 */

const REEXEC_SENTINEL = "VIS_X_REEXEC";

/** Options for {@link runFile}. */
export interface RunFileOptions {
    /**
     * `--node` escape hatch: run the target on plain Node with ZERO vis
     * augmentation (no TS load hook, no `--import` preload, no flag injection,
     * no `.env` loading, no polyfills), exactly like `node &lt;file> &lt;args>`.
     */
    node?: boolean;
}

/**
 * Run `file` on plain Node with no augmentation whatsoever — the `--node`
 * escape hatch. Spawns the current Node binary directly (stdio inherited,
 * exit code forwarded); no TS loader, preload, flag injection, `.env`, or
 * polyfills. A `.ts` file is handed to Node as-is (Node decides whether it
 * can run it), since the point of `--node` is "do nothing vis-specific".
 */
const runUnderPlainNode = (file: string, scriptArguments: string[], cwd: string): number => {
    // Strip vis's OWN augmentation from the child env so a nested `vis x --node`
    // is unaugmented even when launched from a parent that set
    // VIS_AUGMENT_SUBPROCESS (which injects `--import <preload>` into NODE_OPTIONS).
    // A user's own ambient NODE_OPTIONS is preserved — "plain node" honours it.
    const environment = { ...process.env };
    const visPreload = join(dirname(process.argv[1] as string), "runtime", "preload.js");

    if (environment["NODE_OPTIONS"]) {
        const stripped = environment["NODE_OPTIONS"]
            .replace(`--import ${JSON.stringify(visPreload)}`, "")
            .replace(`--import ${visPreload}`, "")
            .replaceAll(/\s+/gu, " ")
            .trim();

        if (stripped === "") {
            delete environment["NODE_OPTIONS"];
        } else {
            environment["NODE_OPTIONS"] = stripped;
        }
    }

    delete environment["VIS_AUGMENT_SUBPROCESS"];
    delete environment["VIS_UNFLAG"];
    delete environment["VIS_POLYFILL"];

    const result = spawnSync(process.execPath, [file, ...scriptArguments], { cwd, env: environment, stdio: "inherit" });

    if (result.error) {
        throw result.error;
    }

    return result.status ?? (result.signal === null ? 0 : 1);
};

/** `--localstorage-file` path: `&lt;project-root>/.vis/localstorage` (nearest package.json). */
const localstorageFile = (cwd: string): string => {
    let directory = cwd;

    for (;;) {
        if (existsSync(join(directory, "package.json")) || existsSync(join(directory, ".pnp.cjs"))) {
            return join(directory, ".vis", "localstorage");
        }

        const parent = dirname(directory);

        if (parent === directory) {
            return join(cwd, ".vis", "localstorage");
        }

        directory = parent;
    }
};

/** Node start flags for entry augmentation (unflag + PnP). Empty = no re-exec needed. */
const entryAugmentFlags = (cwd: string): string[] => {
    const unflagSpec = process.env["VIS_UNFLAG"];
    const flags = unflagSpec === undefined ? [] : unflagArgs(unflagSpec, process.versions.node, localstorageFile(cwd));

    return [...flags, ...pnpNodeArgs(cwd)];
};

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

/**
 * Re-exec Node with the entry-augmentation flags, re-running `vis x &lt;file> [args]`;
 * the re-run is flagged via the sentinel env so it skips back here and takes the
 * in-process path with the flags now active. Never returns to the caller.
 */
const reexecWithFlags = (flags: string[], file: string, scriptArguments: string[], cwd: string): number => {
    const result = spawnSync(process.execPath, [...flags, process.argv[1] as string, "x", file, ...scriptArguments], {
        cwd,
        env: { ...process.env, [REEXEC_SENTINEL]: "1" },
        stdio: "inherit",
    });

    return result.status ?? (result.signal === null ? 0 : 1);
};

/** Run `file` in-process under Node, transpiling TS/JSX via vis-native's oxc loader. */
const runUnderNode = async (file: string, scriptArguments: string[], cwd: string): Promise<number> => {
    // Entry augmentation needs Node start flags → re-exec once (unless we already did).
    if (process.env[REEXEC_SENTINEL] === undefined) {
        const flags = entryAugmentFlags(cwd);

        if (flags.length > 0) {
            return reexecWithFlags(flags, file, scriptArguments, cwd);
        }
    }

    // Subprocess augmentation: carry the loader (+ unflag flags) to nested `node`
    // the script spawns, via NODE_OPTIONS. Opt-in.
    if (process.env["VIS_AUGMENT_SUBPROCESS"] !== undefined) {
        const preload = join(dirname(process.argv[1] as string), "runtime", "preload.js");
        const unflagSpec = process.env["VIS_UNFLAG"];
        const childFlags = unflagSpec === undefined ? [] : unflagArgs(unflagSpec, process.versions.node, localstorageFile(cwd));
        const parts = [process.env["NODE_OPTIONS"] ?? "", ...childFlags, `--import ${JSON.stringify(preload)}`].filter(Boolean);

        process.env["NODE_OPTIONS"] = parts.join(" ").trim();
    }

    const { importTs } = await import("../../runtime/ts-loader");

    // Shared `.env` cascade + opt-in polyfills.
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

export const runFile = async (file: string, scriptArguments: string[], runtime: RuntimeId, cwd: string, options: RunFileOptions = {}): Promise<number> => {
    // `--node` short-circuits everything: plain Node, no augmentation.
    if (options.node) {
        return runUnderPlainNode(file, scriptArguments, cwd);
    }

    return runtime === "bun" ? runUnderBun(file, scriptArguments, cwd) : runUnderNode(file, scriptArguments, cwd);
};
