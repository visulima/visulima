import type { Command } from "@visulima/cerebro";

import { resolveInstaller, runWhy } from "../pm-runner";
import { toStringArray } from "../utils";

const why: Command = {
    alias: "explain",
    argument: {
        description: "Package(s) to explain",
        name: "packages",
        type: String,
    },
    description: "Show why a package is installed (dependency chain)",
    examples: [
        ["vis why react", "Show why react is installed"],
        ["vis why react --json", "Output as JSON"],
        ["vis why react -r", "Check across all workspaces"],
        ["vis explain react", "Alias matching npm's command"],
    ],
    execute: async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }) => {
        const packages = argument;

        if (!packages || packages.length === 0) {
            throw new Error("No packages specified. Usage: vis why <package...>");
        }

        const cwd = wsRoot ?? process.cwd();
        const pm = resolveInstaller(cwd, { configBackend: visConfig?.install?.backend });

        const code = runWhy(
            pm,
            {
                depth: options.depth === undefined ? undefined : Number(options.depth),
                dev: (options.dev as boolean) || false,
                filter: toStringArray(options.filter),
                global: (options.global as boolean) || false,
                json: (options.json as boolean) || false,
                long: (options.long as boolean) || false,
                noOptional: (options.noOptional as boolean) || false,
                packages,
                parseable: (options.parseable as boolean) || false,
                prod: (options.prod as boolean) || false,
                recursive: (options.recursive as boolean) || false,
            },
            cwd,
            logger,
        );

        if (code !== 0 && code !== 1) {
            process.exitCode = code;
        }
    },
    group: "Dependencies",
    name: "why",
    options: [
        { defaultValue: false, description: "Output as JSON", name: "json", type: Boolean },
        { defaultValue: false, description: "Show extended information (pnpm)", name: "long", type: Boolean },
        { defaultValue: false, description: "Machine-readable output (pnpm)", name: "parseable", type: Boolean },
        { alias: "r", defaultValue: false, description: "Check across all workspaces", name: "recursive", type: Boolean },
        { alias: "D", defaultValue: false, description: "Filter to dev dependencies (pnpm)", name: "dev", type: Boolean },
        { alias: "P", defaultValue: false, description: "Filter to production dependencies (pnpm)", name: "prod", type: Boolean },
        { defaultValue: false, description: "Exclude optional dependencies (pnpm)", name: "no-optional", type: Boolean },
        { alias: "g", defaultValue: false, description: "Check globally installed packages (pnpm)", name: "global", type: Boolean },
        { description: "Limit dependency tree depth", name: "depth", type: Number },
        { alias: "F", description: "Filter by workspace package name", multiple: true, name: "filter", type: String },
    ],
};

export default why;
