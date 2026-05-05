import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { resolveInstaller, runOutdated } from "../../pm/pm-runner";
import { toStringArray } from "../../util/utils";
import type { OutdatedOptions } from "./index";

const execute = async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, OutdatedOptions>): Promise<void> => {
    const packages = argument || [];
    const cwd = wsRoot ?? process.cwd();
    const pm = resolveInstaller(cwd, { configBackend: visConfig?.install?.backend, configCorepack: visConfig?.install?.corepack });

    const code = runOutdated(
        pm,
        {
            compatible: options.compatible || false,
            dev: options.dev || false,
            filter: toStringArray(options.filter),
            format: options.format || "table",
            global: options.global || false,
            long: options.long || false,
            noOptional: options.noOptional || false,
            packages,
            prod: options.prod || false,
            recursive: options.recursive || false,
            workspaceRoot: options.workspaceRoot || false,
        },
        cwd,
        logger,
    );

    if (code !== 0 && code !== 1) {
        process.exitCode = code;
    }
};

export default execute as CommandExecute<Toolbox>;
