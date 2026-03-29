import type { Command } from "@visulima/cerebro";

import { loadNativeBindings } from "../native-binding";
import { detectPm, runInteractive } from "../pm-runner";

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
        ["vis outdated -g", "Check globally installed packages"],
    ],
    execute: async ({ argument, logger, options, workspaceRoot: wsRoot }) => {
        const packages = (argument as string[]) || [];
        const cwd = (options.cwd as string) ?? wsRoot ?? process.cwd();
        const pm = detectPm(cwd);
        const native = loadNativeBindings();

        if (!native) {
            throw new Error("Native bindings not available.");
        }

        const resolved = native.resolveOutdated(pm.name, pm.version, {
            compatible: (options.compatible as boolean) || false,
            dev: (options.dev as boolean) || false,
            filter: options.filter ? [].concat(options.filter as never) : [],
            format: (options.format as string) || "table",
            global: (options.global as boolean) || false,
            long: (options.long as boolean) || false,
            noOptional: (options["no-optional"] as boolean) || false,
            packages,
            prod: (options.prod as boolean) || false,
            recursive: (options.recursive as boolean) || false,
            workspaceRoot: (options["workspace-root"] as boolean) || false,
        });

        const code = runInteractive(resolved, cwd, logger);

        // Exit code 1 means outdated packages found - this is expected, not an error
        if (code !== 0 && code !== 1) {
            process.exitCode = code;
        }
    },
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
