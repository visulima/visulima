import { isAbsolute, resolve } from "@visulima/path";

import { resolveRuntime } from "../../runtime/resolve-runtime";
import { runFile } from "./run-file";

export interface LeanXArgs {
    /** The file to run, or undefined if none was given. */
    file: string | undefined;

    /**
     * `--node` escape hatch — when present (only valid BEFORE the file), the
     * target runs on the resolved Node with ZERO vis augmentation (no TS hook,
     * no `--import` preload, no flag injection, no `.env` loading, no polyfills),
     * exactly like `node &lt;file> &lt;args>`.
     */
    node: boolean;
    /** `--runtime &lt;id>` / `--runtime=&lt;id>` value, if present before the file. */
    runtimeFlag: string | undefined;
    /** Everything after the file — forwarded verbatim to the script. */
    scriptArguments: string[];
}

/**
 * Parse `vis x` tokens (everything after `vis x`). Recognises `--runtime` and
 * `--node` only BEFORE the file; the first other token is the file, and
 * everything after it (flags included) belongs to the script. Pure — unit-tested.
 */
export const parseLeanXArgs = (argv: string[]): LeanXArgs => {
    let runtimeFlag: string | undefined;
    let node = false;
    let file: string | undefined;
    const scriptArguments: string[] = [];

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index] as string;

        if (file === undefined) {
            if (token === "--node") {
                node = true;

                continue;
            }

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

        scriptArguments.push(token);
    }

    // A single `--` separating the file from its args is consumed, so the script
    // sees its real args (not a literal "--"). Matches the registered handler,
    // where cerebro's parser already eats the separator. `vis x f.ts -- --watch`
    // → the script gets `["--watch"]` on both paths.
    if (scriptArguments[0] === "--") {
        scriptArguments.shift();
    }

    return { file, node, runtimeFlag, scriptArguments };
};

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
    const { file, node, runtimeFlag, scriptArguments } = parseLeanXArgs(argv);

    if (file === undefined) {
        process.stderr.write("No file specified. Usage: vis x <file> [args...]\n");
        process.exitCode = 1;

        return;
    }

    const cwd = process.cwd();
    const absoluteFile = isAbsolute(file) ? file : resolve(cwd, file);

    // `--node`: plain `node <file> <args>`, no runtime resolution, no augmentation.
    if (node) {
        const code = await runFile(absoluteFile, scriptArguments, "node", cwd, { node: true });

        if (code !== 0) {
            process.exitCode = code;
        }

        return;
    }

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
