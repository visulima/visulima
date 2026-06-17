import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { isAbsolute, resolve } from "@visulima/path";

import { resolveCommandRuntime } from "../../runtime/command-runtime";
import type { XOptions } from "./index";
import { runFile } from "./run-file";

/**
 * Registered `vis x` handler. The common invocation takes the lean fast-path in
 * `bin.ts` (`lean.ts`) and never reaches here; this exists so `vis x` is listed
 * in help/completion and works through the full CLI (where the vis-config
 * `runtime:` pin is honoured). Shares the actual execution with `run-file.ts`.
 */
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

    const code = await runFile(absoluteFile, scriptArguments, runtime, cwd);

    if (code !== 0) {
        process.exitCode = code;
    }
};

export default execute as CommandExecute<Toolbox>;
