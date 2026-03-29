import type { Command } from "@visulima/cerebro";

import { detectPm, runRemove } from "../pm-runner";

const toStringArray = (value: unknown): string[] => {
    if (!value) return [];
    return Array.isArray(value) ? value as string[] : [value as string];
};

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
    execute: async ({ argument, logger, options, workspaceRoot: wsRoot }) => {
        const packages = argument as string[];

        if (!packages || packages.length === 0) {
            throw new Error("No packages specified. Usage: vis remove <packages...>");
        }

        const cwd = wsRoot ?? process.cwd();
        const pm = detectPm(cwd);

        const code = runRemove(pm, {
            filter: toStringArray(options.filter),
            global: (options.global as boolean) || false,
            packages,
            recursive: (options.recursive as boolean) || false,
            saveDev: (options["save-dev"] as boolean) || false,
            workspaceRoot: (options["workspace-root"] as boolean) || false,
        }, cwd, logger);

        if (code !== 0) {
            process.exitCode = code;
        }
    },
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
