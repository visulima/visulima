import type { Toolbox } from "@visulima/cerebro";

import { resolveInstaller, runPmSubcommand } from "../../pm/pm-runner";
import { resolveCommandRuntime, runtimeInstallerBackend } from "../../runtime/command-runtime";

const execute = async ({ argument, logger, options, rawUnknown, visConfig, workspaceRoot: wsRoot }: Toolbox): Promise<void> => {
    const positionals = argument;

    if (!positionals || positionals.length === 0) {
        throw new Error(
            "No subcommand specified. Available: cache, publish, audit, list, view, config, whoami, login, logout, pack, owner, dist-tag, search, fund, ping, token, deprecate, rebuild, prune, plugin",
        );
    }

    const [subcommand, ...positionalRest] = positionals;

    // `pm` defines no options, so flags (e.g. `pm publish --dry-run`,
    // `pm list --depth 0`) land in rawUnknown and were historically dropped.
    // Forward them to the PM subcommand (honoring an explicit `--` separator).
    const unknown = rawUnknown ?? [];
    const rest = unknown[0] === "--" ? positionalRest : [...positionalRest, ...unknown];

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

// fallow-ignore-next-line unused-export -- lazy-loaded command entry (cerebro loader/lazyNamed dynamic import)
export default execute;
