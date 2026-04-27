import type { Command } from "@visulima/cerebro";

import { resolveInstaller, runRemove } from "../pm-runner";
import { toStringArray } from "../utils";

const remove: Command = {
    alias: ["rm", "un", "uninstall"],
    argument: {
        description: "Packages to remove",
        name: "packages",
        type: String,
    },
    description: "Remove packages using the detected package manager",
    examples: [
        ["vis remove lodash", "Remove a package"],
        ["vis rm old-package", "Remove using alias"],
        ["vis remove --filter app react", "Remove from specific workspace"],
        ["vis remove -g typescript", "Remove global package"],
    ],
    execute: async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }) => {
        const packages = argument;

        if (!packages || packages.length === 0) {
            throw new Error("No packages specified. Usage: vis remove <packages...>");
        }

        const cwd = process.cwd();
        const pm = resolveInstaller(wsRoot ?? cwd, { configBackend: visConfig?.install?.backend });

        const code = runRemove(
            pm,
            {
                filter: toStringArray(options.filter),
                global: (options.global as boolean) || false,
                packages,
                recursive: (options.recursive as boolean) || false,
                saveDev: (options.saveDev as boolean) || false,
                workspaceRoot: (options.workspaceRoot as boolean) || false,
            },
            cwd,
            logger,
        );

        if (code !== 0) {
            process.exitCode = code;
        }
    },
    group: "Dependencies",
    name: "remove",
    options: [
        { alias: "D", defaultValue: false, description: "Remove from devDependencies", name: "save-dev", type: Boolean },
        { alias: "g", defaultValue: false, description: "Remove global package", name: "global", type: Boolean },
        { alias: "r", defaultValue: false, description: "Remove from all workspace packages", name: "recursive", type: Boolean },
        { alias: "w", defaultValue: false, description: "Remove from workspace root", name: "workspace-root", type: Boolean },
        { alias: "F", description: "Filter by workspace package name", multiple: true, name: "filter", type: String },
    ],
};

export default remove;
