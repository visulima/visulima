import type { Command } from "@visulima/cerebro";

import { detectPm, runLink } from "../pm-runner";

const link: Command = {
    group: "Dependencies",
    alias: "ln",
    argument: {
        description: "Package name or directory path to link (omit to register current package)",
        name: "target",
        type: String,
    },
    description: "Link a local package for development",
    examples: [
        ["vis link", "Register current package globally"],
        ["vis link react", "Link global package to current project"],
        ["vis link ./packages/utils", "Link local directory package"],
    ],
    execute: async ({ argument, logger, workspaceRoot: wsRoot }) => {
        const target = argument?.[0] ?? null;
        const cwd = wsRoot ?? process.cwd();
        const pm = detectPm(cwd);

        const code = runLink(pm, target, cwd, logger);

        if (code !== 0) {
            process.exitCode = code;
        }
    },
    name: "link",
};

export default link;
