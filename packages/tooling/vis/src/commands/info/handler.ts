import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { resolveInstaller, runInfo } from "../../pm-runner";
import type { InfoOptions } from "./index";

const execute = async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, InfoOptions>): Promise<void> => {
    if (!argument || argument.length === 0) {
        throw new Error("No package specified. Usage: vis info <package> [field...]");
    }

    const [pkg, ...fields] = argument;

    const cwd = wsRoot ?? process.cwd();
    const pm = resolveInstaller(cwd, { configBackend: visConfig?.install?.backend });

    const code = runInfo(
        pm,
        {
            fields,
            json: options.json || false,
            package: pkg as string,
        },
        cwd,
        logger,
    );

    // Exit 0 = success; exit 1 = the PM reported "not found" / empty result, which
    // is a normal CLI outcome we don't want to flag as a vis failure. Anything else
    // (network error, auth failure, …) propagates as-is.
    if (code !== 0 && code !== 1) {
        process.exitCode = code;
    }
};

export default execute as CommandExecute<Toolbox>;
