import { execSync } from "node:child_process";

import type { Command } from "@visulima/cerebro";
import { findPackageManagerSync, getPackageManagerVersion } from "@visulima/package";

import type { AiAnalysisResult } from "../ai-analysis";
import { formatAiAnalysis, runAiAnalysis, validateAnalysisType } from "../ai-analysis";
import type { CatalogCheckOptions, OutdatedEntry, UpdateTarget } from "../catalog";
import {
    applyCatalogUpdates,
    checkOutdated,
    fetchChangelogInfo,
    formatOutdatedJson,
    formatOutdatedMinimal,
    formatOutdatedTable,
    formatSummary,
    hasBackup,
    hasCatalogs,
    loadNpmrc,
    promptPackageSelection,
    readCatalogs,
    restoreFromBackup,
    toFilterArray,
} from "../catalog";
import type { UpdateCommandOptions } from "../package-manager";
import { resolveUpdateCommand } from "../package-manager";
import type { VisConfig } from "../workspace";

type CatalogPackageManager = "bun" | "npm" | "pnpm" | "yarn";
type FilterOption = string | string[] | undefined;

const buildCatalogCheckOptions = (
    options: Record<string, unknown>,
    configDefaults: { exclude?: string[]; format?: string; include?: string[]; install?: boolean; prerelease?: boolean; security?: boolean; target?: string },
    argument: string[],
): CatalogCheckOptions => {
    const target = (options.target as string) ?? configDefaults.target ?? "latest";

    if (!["latest", "minor", "patch"].includes(target)) {
        throw new Error(`Invalid target "${target}". Use: latest, minor, or patch.`);
    }

    return {
        exclude: [...toFilterArray(options.exclude as FilterOption), ...toFilterArray(configDefaults.exclude)],
        include: [...toFilterArray(options.include as FilterOption), ...toFilterArray(configDefaults.include), ...argument],
        includePrerelease: (options.prerelease as boolean) || configDefaults.prerelease || false,
        security: (options.security as boolean) || (options.ai as boolean) || configDefaults.security || false,
        target: target as UpdateTarget,
    };
};

const writeFormattedOutput = (entries: OutdatedEntry[], failed: string[], format: string, logger: Console): void => {
    if (format === "json") {
        process.stdout.write(`${formatOutdatedJson({ failed, outdated: entries })}\n`);
    } else if (format === "minimal") {
        process.stdout.write(`${formatOutdatedMinimal(entries)}\n`);
    } else {
        formatOutdatedTable(entries, logger);
        logger.info(formatSummary(entries));
    }
};

const applyCatalogAndInstall = async (
    workspaceRoot: string,
    packageManager: CatalogPackageManager,
    toApply: OutdatedEntry[],
    options: Record<string, unknown>,
    logger: Console,
): Promise<void> => {
    const backupPath = applyCatalogUpdates(workspaceRoot, toApply, packageManager);
    const targetFile = packageManager === "pnpm" ? "pnpm-workspace.yaml" : "package.json";

    logger.info(`\nUpdated ${targetFile}`);

    if (backupPath) {
        logger.info(`Backup saved to ${backupPath}`);
    }

    if (options.changelog) {
        logger.info("\nFetching changelogs...");

        const changelogs = await fetchChangelogInfo(toApply);

        for (const info of changelogs) {
            const url = info.releaseUrl ?? info.repoUrl ?? info.npmUrl;

            logger.info(`  ${info.packageName}: ${url}`);
        }
    }

    if (options.install ?? true) {
        const installCommands: Record<string, string> = {
            bun: "bun install",
            npm: "npm install",
            pnpm: "pnpm install",
            yarn: "yarn install",
        };
        const installCommand = installCommands[packageManager] ?? `${packageManager} install`;

        logger.info(`Running ${installCommand}...\n`);

        try {
            // eslint-disable-next-line sonarjs/os-command -- running detected package manager, not user input
            execSync(installCommand, {
                cwd: workspaceRoot,
                env: process.env,
                stdio: "inherit",
            });
        } catch {
            logger.warn(`${installCommand} failed. You may need to run it manually.`);
        }
    }
};

/* eslint-disable sonarjs/cognitive-complexity */
const executeCatalogUpdate = async (
    workspaceRoot: string,
    packageManager: CatalogPackageManager,
    visConfig: VisConfig,
    options: Record<string, unknown>,
    argument: string[],
    logger: Console,
): Promise<void> => {
    const configDefaults = visConfig.update ?? {};
    const npmrcConfig = loadNpmrc(workspaceRoot);
    const catalogs = readCatalogs(workspaceRoot, packageManager, {
        dev: options.dev as boolean | undefined,
        prod: options.prod as boolean | undefined,
    });

    if (catalogs.size === 0) {
        logger.info("No catalogs found.");

        return;
    }

    const checkOptions = buildCatalogCheckOptions(options, configDefaults, argument);

    let totalDeps = 0;

    for (const deps of catalogs.values()) {
        totalDeps += deps.size;
    }

    logger.info(`Checking ${String(totalDeps)} catalog dependencies...\n`);

    const { failed, outdated } = await checkOutdated(catalogs, checkOptions, npmrcConfig);

    if (failed.length > 0) {
        logger.warn(`Failed to fetch: ${failed.join(", ")}`);
    }

    if (outdated.length === 0) {
        logger.info("All catalog dependencies are up to date.");

        return;
    }

    const format = (options.format as string) ?? configDefaults.format ?? "table";

    // AI analysis runs before dry-run check so it works in both modes
    let aiResult: AiAnalysisResult | undefined;

    if (options.ai) {
        const analysisType = validateAnalysisType((options["ai-type"] as string | undefined) ?? "impact");

        aiResult = await runAiAnalysis(outdated, logger, visConfig.ai, analysisType);
    }

    if (options["dry-run"]) {
        if (format === "json") {
            const output: Record<string, unknown> = { failed, outdated };

            if (aiResult) {
                output.aiAnalysis = aiResult;
            }

            process.stdout.write(`${JSON.stringify(output, undefined, 2)}\n`);
        } else {
            logger.info(`Would update ${String(outdated.length)} dependencies:\n`);
            writeFormattedOutput(outdated, failed, format, logger);

            if (aiResult) {
                logger.info("");
                logger.info(formatAiAnalysis(aiResult));
            }
        }

        return;
    }

    if (aiResult && format !== "json") {
        logger.info(formatAiAnalysis(aiResult));
        logger.info("");
    }

    let toApply = outdated;

    if (options.interactive) {
        toApply = await promptPackageSelection(outdated);

        if (toApply.length === 0) {
            logger.info("No updates selected.");

            return;
        }
    }

    logger.info(`Updating ${String(toApply.length)} catalog dependencies...\n`);
    writeFormattedOutput(toApply, [], format, logger);

    const mergedOptions = { ...options, install: options.install ?? configDefaults.install };

    await applyCatalogAndInstall(workspaceRoot, packageManager, toApply, mergedOptions, logger);
};

const executePmWrapper = (
    workspaceRoot: string,
    packageManager: "bun" | "npm" | "pnpm" | "yarn",
    version: string,
    options: Record<string, unknown>,
    argument: string[],
    logger: Console,
): void => {
    const updateOptions: UpdateCommandOptions = {
        dev: options.dev as boolean,
        filters: toFilterArray(options.filter as FilterOption),
        global: options.global as boolean,
        interactive: options.interactive as boolean,
        latest: (options.latest as boolean) || options.target === "latest",
        noOptional: options["no-optional"] as boolean,
        noSave: options["no-save"] as boolean,
        packages: argument,
        prod: options.prod as boolean,
        recursive: options.recursive as boolean,
        workspaceRoot: options["workspace-root"] as boolean,
    };

    const { command, warnings } = resolveUpdateCommand(packageManager, version, updateOptions);

    for (const warning of warnings) {
        logger.warn(warning);
    }

    const fullCommand = `${command.bin} ${command.args.join(" ")}`.trim();

    if (options["dry-run"]) {
        logger.info(`Would run: ${fullCommand}`);

        return;
    }

    logger.info(`Running: ${fullCommand}`);

    try {
        // eslint-disable-next-line sonarjs/os-command -- command sourced from detected package manager binary, not user input
        execSync(fullCommand, {
            cwd: workspaceRoot,
            env: process.env,
            stdio: "inherit",
        });
    } catch (error: unknown) {
        const execError = error as { status?: number };
        const exitCode = execError.status ?? 1;

        throw new Error(`Update command failed with exit code ${String(exitCode)}`, { cause: error });
    }
};

const update: Command = {
    alias: "up",
    argument: {
        description: "Packages to update (updates all if omitted)",
        name: "packages",
        type: String,
    },
    description: "Update packages to their latest versions",
    examples: [
        ["vis update react", "Update react within semver range"],
        ["vis up react -L", "Update react to latest"],
        ["vis update -i", "Interactive mode"],
        ["vis update --filter app", "Update in specific workspace"],
        ["vis update -r", "Update in all workspaces"],
        ["vis update --target minor", "Only apply minor/patch updates (catalog mode)"],
        ["vis update --dry-run", "Preview changes without applying"],
        ["vis update --exclude '@types/*'", "Exclude packages by pattern"],
        ["vis update --changelog", "Show changelog links after updating"],
        ["vis update --rollback", "Restore catalog from last backup"],
        ["vis update --ai", "Run AI analysis before applying updates"],
    ],
    execute: async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }) => {
        if (!wsRoot) {
            throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
        }

        const workspaceRoot = wsRoot;
        const { packageManager } = findPackageManagerSync(workspaceRoot);

        // Rollback mode
        if (options.rollback) {
            if (!hasBackup(workspaceRoot, packageManager)) {
                logger.info("No backup found. Run 'vis update' first to create a backup.");

                return;
            }

            const restored = restoreFromBackup(workspaceRoot, packageManager);

            if (restored) {
                logger.info("Restored from backup.");
            } else {
                throw new Error("Failed to restore from backup.");
            }

            return;
        }

        // Catalog mode: pnpm/bun with catalogs detected, unless --no-catalog
        const useCatalogMode = !options["no-catalog"] && hasCatalogs(workspaceRoot, packageManager);

        if (useCatalogMode) {
            await executeCatalogUpdate(workspaceRoot, packageManager as CatalogPackageManager, visConfig ?? {}, options, argument, logger);
        } else {
            const version = getPackageManagerVersion(packageManager);

            executePmWrapper(workspaceRoot, packageManager, version, options, argument, logger);
        }
    },
    name: "update",
    options: [
        {
            alias: "L",
            defaultValue: false,
            description: "Update to latest version (ignore semver range)",
            name: "latest",
            type: Boolean,
        },
        {
            alias: "t",
            description: "Update target: latest, minor, or patch (default: latest, catalog mode)",
            name: "target",
            type: String,
        },
        {
            alias: "d",
            defaultValue: false,
            description: "Preview changes without applying",
            name: "dry-run",
            type: Boolean,
        },
        {
            alias: "g",
            defaultValue: false,
            description: "Update global packages",
            name: "global",
            type: Boolean,
        },
        {
            alias: "r",
            defaultValue: false,
            description: "Update recursively in all workspace packages",
            name: "recursive",
            type: Boolean,
        },
        {
            description: "Filter packages in monorepo",
            name: "filter",
            type: String,
        },
        {
            alias: "w",
            defaultValue: false,
            description: "Include workspace root",
            name: "workspace-root",
            type: Boolean,
        },
        {
            alias: "D",
            defaultValue: false,
            description: "Update only devDependencies",
            name: "dev",
            type: Boolean,
        },
        {
            alias: "P",
            defaultValue: false,
            description: "Update only dependencies",
            name: "prod",
            type: Boolean,
        },
        {
            alias: "i",
            defaultValue: false,
            description: "Interactive mode",
            name: "interactive",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Don't update optionalDependencies",
            name: "no-optional",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Update lockfile only",
            name: "no-save",
            type: Boolean,
        },
        {
            description: "Glob pattern to include packages (repeatable, catalog mode)",
            lazyMultiple: true,
            name: "include",
            type: String,
        },
        {
            description: "Glob pattern to exclude packages (repeatable, catalog mode)",
            lazyMultiple: true,
            name: "exclude",
            type: String,
        },
        {
            defaultValue: false,
            description: "Include prerelease versions (catalog mode)",
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
            defaultValue: false,
            description: "Skip catalog mode, use package manager directly",
            name: "no-catalog",
            type: Boolean,
        },
        {
            description: "Output format: table, json, or minimal (default: table)",
            name: "format",
            type: String,
        },
        {
            defaultValue: false,
            description: "Show changelog URLs for updated packages",
            name: "changelog",
            type: Boolean,
        },
        {
            description: "Run install after catalog update, --no-install to skip (default: true)",
            name: "install",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Restore catalog file from the last backup",
            name: "rollback",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Run AI analysis on outdated packages before updating (catalog mode)",
            name: "ai",
            type: Boolean,
        },
        {
            description: "AI analysis type: impact, security, compatibility, or recommend (default: impact)",
            name: "ai-type",
            type: String,
        },
    ],
};

export default update;
