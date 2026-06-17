import type { Toolbox } from "@visulima/cerebro";

import { resolveInstaller, runPmSubcommand } from "../../pm/pm-runner";
import { resolveCommandRuntime, runtimeInstallerBackend } from "../../runtime/command-runtime";

const execute = async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox): Promise<void> => {
    const args = argument;

    if (!args || args.length === 0) {
        throw new Error(
            "No subcommand specified. Available: cache, publish, audit, list, view, config, whoami, login, logout, pack, owner, dist-tag, search, fund, ping, token, deprecate, rebuild, prune, plugin",
        );
    }

    const [subcommand, ...rest] = args;
    const cwd = wsRoot ?? process.cwd();
    const runtime = resolveCommandRuntime({ logger, options, visConfig }, cwd);
    const pm = resolveInstaller(cwd, {
        backend: runtimeInstallerBackend(runtime),
        configBackend: visConfig?.install?.backend,
        configCorepack: visConfig?.install?.corepack,
    });

    const code = runPmSubcommand(pm, subcommand as string, rest, cwd, logger);

    if (code !== 0) {
        process.exitCode = code;
    }
};

export default execute;
