import { isAbsolute, resolve } from "@visulima/path";

import { resolveRuntime } from "../../runtime/resolve-runtime";
import { runFile } from "./run-file";

/**
 * Lean fast-path for `vis x`, invoked directly from `bin.ts` so it never loads
 * the full CLI (cerebro + 60 commands + plugins + config loader). Runtime is
 * resolved from `--runtime` / `VIS_RUNTIME` / lockfile only — the vis-config
 * `runtime:` pin is intentionally skipped here, since loading the config would
 * pull the heavy loader and defeat the fast-path. The registered `vis x` handler
 * (which already has config in its toolbox) covers the config-pin case.
 * @param argv `process.argv.slice(3)` — tokens after `vis x`.
 */
export const runLeanX = async (argv: string[]): Promise<void> => {
    let runtimeFlag: string | undefined;
    let file: string | undefined;
    const scriptArguments: string[] = [];

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index] as string;

        if (file === undefined) {
            // Before the file: recognise --runtime; everything else is the file.
            if (token === "--runtime") {
                runtimeFlag = argv[index + 1];
                index += 1;

                continue;
            }

            if (token.startsWith("--runtime=")) {
                runtimeFlag = token.slice("--runtime=".length);

                continue;
            }

            file = token;

            continue;
        }

        // After the file: everything (flags included) belongs to the script.
        scriptArguments.push(token);
    }

    if (file === undefined) {
        process.stderr.write("No file specified. Usage: vis x <file> [args...]\n");
        process.exitCode = 1;

        return;
    }

    const cwd = process.cwd();
    const absoluteFile = isAbsolute(file) ? file : resolve(cwd, file);

    let runtime;

    try {
        runtime = resolveRuntime(cwd, { flag: runtimeFlag });
    } catch (error) {
        process.stderr.write(`${(error as Error).message}\n`);
        process.exitCode = 1;

        return;
    }

    if (runtime.deferredNotice !== undefined) {
        process.stderr.write(`${runtime.deferredNotice}\n`);
    }

    const code = await runFile(absoluteFile, scriptArguments, runtime.runtime, cwd);

    if (code !== 0) {
        process.exitCode = code;
    }
};
