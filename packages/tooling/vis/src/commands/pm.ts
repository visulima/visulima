import type { Command } from "@visulima/cerebro";

import { loadNativeBindings } from "../native-binding";
import { detectPm, runInteractive } from "../pm-runner";

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
        ["vis pm view react version", "View package info"],
        ["vis pm audit", "Run security audit"],
        ["vis pm whoami", "Show logged-in user"],
        ["vis pm config get registry", "Get config value"],
    ],
    execute: async ({ argument, logger, options, workspaceRoot: wsRoot }) => {
        const args = argument as string[];

        if (!args || args.length === 0) {
            throw new Error(
                "No subcommand specified. Available: cache, publish, audit, list, view, config, whoami, login, logout, pack, owner, dist-tag, search, fund, ping, token, deprecate, rebuild, prune",
            );
        }

        const [subcommand, ...rest] = args;
        const cwd = (options.cwd as string) ?? wsRoot ?? process.cwd();
        const pm_ = detectPm(cwd);
        const native = loadNativeBindings();

        if (!native) {
            throw new Error("Native bindings not available.");
        }

        const resolved = native.resolvePmCommand(pm_.name, pm_.version, subcommand as string, rest);

        const code = runInteractive(resolved, cwd, logger);

        if (code !== 0) {
            process.exitCode = code;
        }
    },
    name: "pm",
};

export default pm;
