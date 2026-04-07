import type { Command } from "@visulima/cerebro";

import { detectPm, runUnlink } from "../pm-runner";

const unlink: Command = {
    group: "Dependencies",
    argument: {
        description: "Packages to unlink (omit for current package)",
        name: "packages",
        type: String,
    },
    description: "Unlink a previously linked package",
    examples: [
        ["vis unlink", "Unlink current package"],
        ["vis unlink react", "Unlink specific package"],
        ["vis unlink -r", "Unlink in all workspace packages"],
    ],
    execute: async ({ argument, logger, options, workspaceRoot: wsRoot }) => {
        const packages = argument || [];
        const cwd = wsRoot ?? process.cwd();
        const pm = detectPm(cwd);

        const code = runUnlink(pm, packages, (options.recursive as boolean) || false, cwd, logger);

        if (code !== 0) {
            process.exitCode = code;
        }
    },
    name: "unlink",
    options: [{ alias: "r", defaultValue: false, description: "Unlink in all workspace packages", name: "recursive", type: Boolean }],
};

export default unlink;
