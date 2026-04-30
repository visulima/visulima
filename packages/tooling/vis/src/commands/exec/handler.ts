import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { resolveInstaller, runExec } from "../../pm/pm-runner";
import { toStringArray } from "../../util/utils";
import type { ExecOptions } from "./index";

const execute = async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, ExecOptions>): Promise<void> => {
    const args = argument;

    if (!args || args.length === 0) {
        throw new Error("No command specified. Usage: vis exec <command> [args...]");
    }

    const [command, ...rest] = args;
    const cwd = wsRoot ?? process.cwd();
    const pm = resolveInstaller(cwd, { configBackend: visConfig?.install?.backend });

    const code = runExec(
        pm,
        {
            args: rest,
            command: command as string,
            filter: toStringArray(options.filter),
            parallel: options.parallel || false,
            recursive: options.recursive || false,
            reverse: options.reverse || false,
            shellMode: options.shellMode || false,
            workspaceRoot: options.workspaceRoot || false,
        },
        cwd,
        logger,
    );

    if (code !== 0) {
        process.exitCode = code;
    }
};

export default execute as CommandExecute<Toolbox>;
