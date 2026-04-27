import type { Command } from "@visulima/cerebro";

import { resolveInstaller, runOutdated } from "../pm-runner";
import { toStringArray } from "../utils";

const outdated: Command = {
    argument: {
        description: "Specific packages to check (checks all if omitted)",
        name: "packages",
        type: String,
    },
    description: "Check for outdated packages using the detected package manager",
    examples: [
        ["vis outdated", "Check all packages"],
        ["vis outdated react", "Check specific package"],
        ["vis outdated --format json", "Output as JSON"],
        ["vis outdated -r", "Check across all workspaces"],
    ],
    execute: async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }) => {
        const packages = argument || [];
        const cwd = wsRoot ?? process.cwd();
        const pm = resolveInstaller(cwd, { configBackend: visConfig?.install?.backend });

        const code = runOutdated(
            pm,
            {
                compatible: (options.compatible as boolean) || false,
                dev: (options.dev as boolean) || false,
                filter: toStringArray(options.filter),
                format: (options.format as string) || "table",
                global: (options.global as boolean) || false,
                long: (options.long as boolean) || false,
                noOptional: (options.noOptional as boolean) || false,
                packages,
                prod: (options.prod as boolean) || false,
                recursive: (options.recursive as boolean) || false,
                workspaceRoot: (options.workspaceRoot as boolean) || false,
            },
            cwd,
            logger,
        );

        if (code !== 0 && code !== 1) {
            process.exitCode = code;
        }
    },
    group: "Security & Health",
    name: "outdated",
    options: [
        { defaultValue: false, description: "Show extended information", name: "long", type: Boolean },
        { defaultValue: "table", description: "Output format: table, list, or json", name: "format", type: String },
        { alias: "r", defaultValue: false, description: "Check all workspaces", name: "recursive", type: Boolean },
        { alias: "w", defaultValue: false, description: "Include workspace root", name: "workspace-root", type: Boolean },
        { alias: "P", defaultValue: false, description: "Production dependencies only (pnpm)", name: "prod", type: Boolean },
        { alias: "D", defaultValue: false, description: "Dev dependencies only (pnpm)", name: "dev", type: Boolean },
        { defaultValue: false, description: "Exclude optional dependencies (pnpm)", name: "no-optional", type: Boolean },
        { defaultValue: false, description: "Show only semver-compatible updates (pnpm)", name: "compatible", type: Boolean },
        { alias: "g", defaultValue: false, description: "Check globally installed packages", name: "global", type: Boolean },
        { alias: "F", description: "Filter by workspace package name", multiple: true, name: "filter", type: String },
    ],
};

export default outdated;
