import type { Command } from "@visulima/cerebro";

import { resolveInstaller, runPmSubcommand } from "../pm-runner";

const pm: Command = {
    argument: {
        description: "Subcommand and arguments (e.g., cache dir, publish --dry-run, list --depth 0)",
        name: "args",
        type: String,
    },
    description: "Package manager utilities (cache, publish, audit, list, config, etc.)",
    examples: [
        ["vis pm cache dir", "Show cache directory"],
        ["vis pm cache clean", "Clean cache"],
        ["vis pm publish --dry-run", "Preview publishing"],
        ["vis pm list --depth 0", "List direct dependencies"],
        ["vis pm audit", "Run security audit"],
        ["vis pm whoami", "Show logged-in user"],
    ],
    execute: async ({ argument, logger, visConfig, workspaceRoot: wsRoot }) => {
        const args = argument;

        if (!args || args.length === 0) {
            throw new Error(
                "No subcommand specified. Available: cache, publish, audit, list, view, config, whoami, login, logout, pack, owner, dist-tag, search, fund, ping, token, deprecate, rebuild, prune",
            );
        }

        const [subcommand, ...rest] = args;
        const cwd = wsRoot ?? process.cwd();
        const pm_ = resolveInstaller(cwd, { configBackend: visConfig?.install?.backend });

        const code = runPmSubcommand(pm_, subcommand as string, rest, cwd, logger);

        if (code !== 0) {
            process.exitCode = code;
        }
    },
    group: "System",
    name: "pm",
};

export default pm;
