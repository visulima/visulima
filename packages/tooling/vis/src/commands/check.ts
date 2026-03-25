import type { Command } from "@visulima/cerebro";
import { findPackageManagerSync } from "@visulima/package";

import type { CatalogCheckOptions, UpdateTarget } from "../catalog";
import {
    checkOutdated,
    formatOutdatedJson,
    formatOutdatedMinimal,
    formatOutdatedTable,
    formatSummary,
    loadNpmrc,
    readCatalogs,
    toFilterArray,
} from "../catalog";

const check: Command = {
    alias: "c",
    argument: {
        description: "Specific packages to check (checks all if omitted)",
        name: "packages",
        type: String,
    },
    description: "Check for outdated dependencies in workspace catalogs (pnpm/bun)",
    examples: [
        ["vis check", "Check all catalog dependencies"],
        ["vis check react", "Check specific packages"],
        ["vis check --target minor", "Only show minor/patch updates"],
        ["vis check --exclude '@types/*'", "Exclude packages by pattern"],
    ],
    execute: async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }) => {
        if (!wsRoot) {
            throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
        }

        const workspaceRoot = wsRoot;
        const { packageManager } = findPackageManagerSync(workspaceRoot);

        if (packageManager !== "pnpm" && packageManager !== "bun") {
            throw new Error("The check command is only supported for pnpm or bun workspaces with catalogs.");
        }

        const npmrcConfig = loadNpmrc(workspaceRoot);
        const configDefaults = visConfig?.update ?? {};
        const catalogs = readCatalogs(workspaceRoot, packageManager);

        if (catalogs.size === 0) {
            logger.info("No catalogs found.");

            return;
        }

        const target = (options.target as string) ?? configDefaults.target ?? "latest";

        if (!["latest", "minor", "patch"].includes(target)) {
            throw new Error(`Invalid target "${target}". Use: latest, minor, or patch.`);
        }

        const checkOptions: CatalogCheckOptions = {
            exclude: [...toFilterArray(options.exclude as string | string[] | undefined), ...toFilterArray(configDefaults.exclude)],
            include: [...toFilterArray(options.include as string | string[] | undefined), ...toFilterArray(configDefaults.include), ...(argument as string[])],
            includePrerelease: (options.prerelease as boolean) || configDefaults.prerelease || false,
            security: (options.security as boolean) || configDefaults.security || false,
            target: target as UpdateTarget,
        };

        let totalDeps = 0;

        for (const deps of catalogs.values()) {
            totalDeps += deps.size;
        }

        logger.info(`Checking ${String(totalDeps)} catalog dependencies against npm registry...\n`);

        const { failed, outdated } = await checkOutdated(catalogs, checkOptions, npmrcConfig);

        if (failed.length > 0) {
            logger.warn(`Failed to fetch: ${failed.join(", ")}`);
        }

        if (outdated.length === 0) {
            logger.info("All catalog dependencies are up to date.");

            return;
        }

        const format = (options.format as string) ?? configDefaults.format ?? "table";

        if (format === "json") {
            process.stdout.write(`${formatOutdatedJson({ failed, outdated })}\n`);
        } else if (format === "minimal") {
            process.stdout.write(`${formatOutdatedMinimal(outdated)}\n`);
        } else {
            formatOutdatedTable(outdated, logger);
            logger.info(formatSummary(outdated));
        }

        if (options["exit-code"] && outdated.length > 0) {
            process.exitCode = 1;
        }
    },
    name: "check",
    options: [
        {
            alias: "t",
            description: "Update target: latest, minor, or patch (default: latest)",
            name: "target",
            type: String,
        },
        {
            description: "Glob pattern to include packages (repeatable)",
            lazyMultiple: true,
            name: "include",
            type: String,
        },
        {
            description: "Glob pattern to exclude packages (repeatable)",
            lazyMultiple: true,
            name: "exclude",
            type: String,
        },
        {
            defaultValue: false,
            description: "Include prerelease versions",
            name: "prerelease",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Check for known security vulnerabilities (via OSV.dev)",
            name: "security",
            type: Boolean,
        },
        {
            description: "Output format: table, json, or minimal (default: table)",
            name: "format",
            type: String,
        },
        {
            defaultValue: false,
            description: "Exit with code 1 if outdated dependencies found (for CI)",
            name: "exit-code",
            type: Boolean,
        },
    ],
};

export default check;
