import type { Command } from "@visulima/cerebro";

import { detectPm, runAdd } from "../pm-runner";
import { toStringArray } from "../utils";

const add: Command = {
    argument: {
        description: "Packages to add (e.g., react react-dom)",
        name: "packages",
        type: String,
    },
    description: "Add packages using the detected package manager",
    examples: [
        ["vis add react react-dom", "Add packages"],
        ["vis add -D typescript @types/react", "Add as dev dependencies"],
        ["vis add react --filter app", "Add to specific workspace package"],
        ["vis add -g typescript", "Add globally (uses npm)"],
        ["vis add lodash -w", "Add to workspace root"],
    ],
    execute: async ({ argument, logger, options, workspaceRoot: wsRoot }) => {
        const packages = argument;

        if (!packages || packages.length === 0) {
            throw new Error("No packages specified. Usage: vis add <packages...>");
        }

        // Default to current directory; workspace root used only for PM detection
        const cwd = process.cwd();
        const pm = detectPm(wsRoot ?? cwd);

        const code = runAdd(
            pm,
            {
                exact: (options.exact as boolean) || false,
                filter: toStringArray(options.filter),
                global: (options.global as boolean) || false,
                optional: (options["save-optional"] as boolean) || false,
                packages,
                peer: (options["save-peer"] as boolean) || false,
                saveDev: (options["save-dev"] as boolean) || false,
                workspace: (options.workspace as boolean) || false,
                workspaceRoot: (options["workspace-root"] as boolean) || false,
            },
            cwd,
            logger,
        );

        if (code !== 0) {
            process.exitCode = code;
        }
    },
    name: "add",
    options: [
        { alias: "D", defaultValue: false, description: "Add as dev dependency", name: "save-dev", type: Boolean },
        { alias: "E", defaultValue: false, description: "Save exact version", name: "exact", type: Boolean },
        { alias: "P", defaultValue: false, description: "Add as peer dependency", name: "save-peer", type: Boolean },
        { alias: "O", defaultValue: false, description: "Add as optional dependency", name: "save-optional", type: Boolean },
        { alias: "g", defaultValue: false, description: "Install globally (uses npm)", name: "global", type: Boolean },
        { alias: "w", defaultValue: false, description: "Add to workspace root", name: "workspace-root", type: Boolean },
        { defaultValue: false, description: "Use workspace protocol (pnpm)", name: "workspace", type: Boolean },
        { alias: "F", description: "Filter by workspace package name", multiple: true, name: "filter", type: String },
    ],
};

export default add;
