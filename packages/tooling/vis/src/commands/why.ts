import type { Command } from "@visulima/cerebro";

import { loadNativeBindings } from "../native-binding";
import { detectPm, runInteractive } from "../pm-runner";

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
        ["vis why react --depth 2", "Limit dependency tree depth"],
    ],
    execute: async ({ argument, logger, options, workspaceRoot: wsRoot }) => {
        const packages = argument as string[];

        if (!packages || packages.length === 0) {
            throw new Error("No packages specified. Usage: vis why <package...>");
        }

        const cwd = (options.cwd as string) ?? wsRoot ?? process.cwd();
        const pm = detectPm(cwd);
        const native = loadNativeBindings();

        if (!native) {
            throw new Error("Native bindings not available.");
        }

        const resolved = native.resolveWhy(pm.name, pm.version, {
            depth: options.depth !== undefined ? Number(options.depth) : undefined,
            dev: (options.dev as boolean) || false,
            filter: options.filter ? [].concat(options.filter as never) : [],
            global: (options.global as boolean) || false,
            json: (options.json as boolean) || false,
            long: (options.long as boolean) || false,
            noOptional: (options["no-optional"] as boolean) || false,
            packages,
            parseable: (options.parseable as boolean) || false,
            prod: (options.prod as boolean) || false,
            recursive: (options.recursive as boolean) || false,
        });

        const code = runInteractive(resolved, cwd, logger);

        // Exit code 1 from 'why' means "not found" which is valid output
        if (code !== 0 && code !== 1) {
            process.exitCode = code;
        }
    },
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
