import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { resolveInstaller, runWhy } from "../../pm/pm-runner";
import { toStringArray } from "../../util/utils";
import type { WhyOptions } from "./index";

const execute = async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, WhyOptions>): Promise<void> => {
    const packages = argument;

    if (!packages || packages.length === 0) {
        throw new Error("No packages specified. Usage: vis why <package...>");
    }

    const cwd = wsRoot ?? process.cwd();
    const pm = resolveInstaller(cwd, { configBackend: visConfig?.install?.backend, configCorepack: visConfig?.install?.corepack });

    const code = runWhy(
        pm,
        {
            depth: options.depth === undefined ? undefined : Number(options.depth),
            dev: options.dev || false,
            filter: toStringArray(options.filter),
            global: options.global || false,
            json: options.json || false,
            long: options.long || false,
            noOptional: options.noOptional || false,
            packages,
            parseable: options.parseable || false,
            prod: options.prod || false,
            recursive: options.recursive || false,
        },
        cwd,
        logger,
    );

    if (code !== 0 && code !== 1) {
        process.exitCode = code;
    }
};

export default execute as CommandExecute<Toolbox>;
