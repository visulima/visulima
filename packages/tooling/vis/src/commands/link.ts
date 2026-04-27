import type { Command } from "@visulima/cerebro";

import { resolveInstaller, runLink } from "../pm-runner";

const link: Command = {
    alias: "ln",
    argument: {
        description: "Package name or directory path to link (omit to register current package)",
        name: "target",
        type: String,
    },
    description: "Link a local package for development",
    examples: [
        ["vis link ./packages/utils", "Link local directory package (works on all PMs)"],
        ["vis link", "Register current package globally (pnpm <=10, yarn, npm, bun)"],
        ["vis link react", "Link global package into current project (pnpm <=10, yarn, npm, bun)"],
    ],
    execute: async ({ argument, logger, visConfig, workspaceRoot: wsRoot }) => {
        const target = argument?.[0] ?? null;
        const cwd = wsRoot ?? process.cwd();
        const pm = resolveInstaller(cwd, { configBackend: visConfig?.install?.backend });

        const code = runLink(pm, target, cwd, logger);

        if (code !== 0) {
            process.exitCode = code;
        }
    },
    group: "Dependencies",
    name: "link",
};

export default link;
