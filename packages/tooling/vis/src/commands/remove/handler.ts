import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { resolveInstaller, runRemove } from "../../pm-runner";
import { toStringArray } from "../../utils";
import type { RemoveOptions } from "./index";

const execute = async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, RemoveOptions>): Promise<void> => {
    const packages = argument;

    if (!packages || packages.length === 0) {
        throw new Error("No packages specified. Usage: vis remove <packages...>");
    }

    const cwd = process.cwd();
    const pm = resolveInstaller(wsRoot ?? cwd, { configBackend: visConfig?.install?.backend });

    const code = runRemove(
        pm,
        {
            filter: toStringArray(options.filter),
            global: options.global || false,
            packages,
            recursive: options.recursive || false,
            saveDev: options.saveDev || false,
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
