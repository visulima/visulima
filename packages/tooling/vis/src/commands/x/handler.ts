import { spawnSync } from "node:child_process";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { isAbsolute, resolve } from "@visulima/path";

import { resolveCommandRuntime } from "../../runtime/command-runtime";
import type { XOptions } from "./index";

// Node's own type-transform covers the full TS surface (enums, decorators,
// parameter properties), unlike default strip-only. Available on every Node vis
// supports (^22.14 || >=24.10 — the flag landed in 22.7). The warning is
// suppressed so script output stays clean. The native oxc loader (the fast path,
// and the only one that also handles JSX) replaces this spawn later without
// changing the command surface.
const NODE_TS_FLAGS = ["--experimental-transform-types", "--disable-warning=ExperimentalWarning"];

/** Run `file` (+ args) under Node, transpiling TS via Node's native transform. */
const runUnderNode = (file: string, scriptArguments: string[], cwd: string): number => {
    const result = spawnSync(process.execPath, [...NODE_TS_FLAGS, file, ...scriptArguments], { cwd, stdio: "inherit" });

    if (result.error) {
        throw result.error;
    }

    return result.status ?? (result.signal ? 1 : 0);
};

/** Run `file` (+ args) under Bun, which transpiles TS/JSX natively. */
const runUnderBun = (file: string, scriptArguments: string[], cwd: string): number => {
    const result = spawnSync("bun", ["run", file, ...scriptArguments], { cwd, stdio: "inherit" });

    if (result.error) {
        const { code } = (result.error as NodeJS.ErrnoException);

        if (code === "ENOENT") {
            throw new Error("Runtime is set to bun but the `bun` binary is not on PATH. Install it from https://bun.sh.");
        }

        throw result.error;
    }

    return result.status ?? (result.signal ? 1 : 0);
};

const execute = async ({ argument, logger, options, rawUnknown, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, XOptions>): Promise<void> => {
    const positionals = argument ?? [];
    const [file, ...rest] = positionals;

    if (file === undefined) {
        throw new Error("No file specified. Usage: vis x <file> [args...]");
    }

    const cwd = process.cwd();
    const absoluteFile = isAbsolute(file) ? file : resolve(cwd, file);
    // Positional args after the file, plus anything after `--`.
    const scriptArguments = [...rest, ...(rawUnknown ?? [])];

    const { runtime } = resolveCommandRuntime({ logger, options, visConfig }, wsRoot ?? cwd);

    const code = runtime === "bun" ? runUnderBun(absoluteFile, scriptArguments, cwd) : runUnderNode(absoluteFile, scriptArguments, cwd);

    if (code !== 0) {
        process.exitCode = code;
    }
};

export default execute as CommandExecute<Toolbox>;
