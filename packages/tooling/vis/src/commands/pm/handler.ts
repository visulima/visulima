import type { Toolbox } from "@visulima/cerebro";

import { resolveInstaller, runPmSubcommand } from "../../pm/pm-runner";

const execute = async ({ argument, logger, visConfig, workspaceRoot: wsRoot }: Toolbox): Promise<void> => {
    const args = argument;

    if (!args || args.length === 0) {
        throw new Error(
            "No subcommand specified. Available: cache, publish, audit, list, view, config, whoami, login, logout, pack, owner, dist-tag, search, fund, ping, token, deprecate, rebuild, prune",
        );
    }

    const [subcommand, ...rest] = args;
    const cwd = wsRoot ?? process.cwd();
    const pm = resolveInstaller(cwd, { configBackend: visConfig?.install?.backend });

    const code = runPmSubcommand(pm, subcommand as string, rest, cwd, logger);

    if (code !== 0) {
        process.exitCode = code;
    }
};

export default execute;
