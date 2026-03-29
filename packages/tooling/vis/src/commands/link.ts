import type { Command } from "@visulima/cerebro";

import { loadNativeBindings } from "../native-binding";
import { detectPm, runInteractive } from "../pm-runner";

const link: Command = {
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
        ["vis ln ./lib", "Link using alias"],
    ],
    execute: async ({ argument, logger, options, workspaceRoot: wsRoot }) => {
        const target = (argument as string[])?.[0] ?? undefined;
        const cwd = (options.cwd as string) ?? wsRoot ?? process.cwd();
        const pm = detectPm(cwd);
        const native = loadNativeBindings();

        if (!native) {
            throw new Error("Native bindings not available.");
        }

        const resolved = native.resolveLink(pm.name, pm.version, target ?? null);

        const code = runInteractive(resolved, cwd, logger);

        if (code !== 0) {
            process.exitCode = code;
        }
    },
    name: "link",
};

export default link;
