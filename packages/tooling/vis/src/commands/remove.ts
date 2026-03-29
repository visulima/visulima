import type { Command } from "@visulima/cerebro";

import { loadNativeBindings } from "../native-binding";
import { detectPm, runInteractive } from "../pm-runner";

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
        ["vis remove -r lodash", "Remove from all workspace packages"],
    ],
    execute: async ({ argument, logger, options, workspaceRoot: wsRoot }) => {
        const packages = argument as string[];

        if (!packages || packages.length === 0) {
            throw new Error("No packages specified. Usage: vis remove <packages...>");
        }

        const cwd = (options.cwd as string) ?? wsRoot ?? process.cwd();
        const pm = detectPm(cwd);
        const native = loadNativeBindings();

        if (!native) {
            throw new Error("Native bindings not available.");
        }

        const resolved = native.resolveRemove(pm.name, pm.version, {
            filter: options.filter ? [].concat(options.filter as never) : [],
            global: (options.global as boolean) || false,
            packages,
            recursive: (options.recursive as boolean) || false,
            saveDev: (options["save-dev"] as boolean) || false,
            workspaceRoot: (options["workspace-root"] as boolean) || false,
        });

        const code = runInteractive(resolved, cwd, logger);

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
