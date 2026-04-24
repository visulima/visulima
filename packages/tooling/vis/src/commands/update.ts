import { execSync } from "node:child_process";

import type { Command } from "@visulima/cerebro";
import colorize from "@visulima/colorize";

const { red, yellow } = colorize;
import { isAccessibleSync, readJsonSync } from "@visulima/fs";
import { readYamlSync } from "@visulima/fs/yaml";
import { findPackageManagerSync, getPackageManagerVersion } from "@visulima/package";
import { join } from "@visulima/path";
import { render, renderToString, Text } from "@visulima/tui";
import isInCi from "is-in-ci";
import React from "react";

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
import { buildSocketOptions, scoreColor } from "../socket-security";
import CheckProgressApp from "../tui/components/CheckProgressApp";
import { UpdateStore } from "../tui/components/update/UpdateStore";
import VisUpdateApp from "../tui/components/update/VisUpdateApp";
import { runTyposquatCheck, scanDepsForTyposquats } from "../typosquats";
import { parsePackageArgument } from "../utils";
import type { VisConfig } from "../workspace";

type CatalogPackageManager = "bun" | "npm" | "pnpm" | "yarn";
type FilterOption = string | string[] | undefined;

/**
 * Reads `minimumReleaseAge` from the package manager's native config.
 * Returns the value in minutes, or undefined if not set.
 */
const readPmNativeMinimumReleaseAge = (workspaceRoot: string, packageManager: string): number | undefined => {
    try {
        if (packageManager === "pnpm") {
            const yamlPath = join(workspaceRoot, "pnpm-workspace.yaml");

            if (isAccessibleSync(yamlPath)) {
                const data = readYamlSync(yamlPath) as { minimumReleaseAge?: number } | undefined;

                if (typeof data?.minimumReleaseAge === "number") {
                    return data.minimumReleaseAge;
                }
            }
        } else if (packageManager === "bun") {
            const pkgPath = join(workspaceRoot, "package.json");

            if (isAccessibleSync(pkgPath)) {
                const pkg = readJsonSync(pkgPath) as { minimumReleaseAge?: number };

                if (typeof pkg.minimumReleaseAge === "number") {
                    return pkg.minimumReleaseAge;
                }
            }
        }
    } catch {
        // Non-critical: if parsing fails, skip the sync check
    }

    return undefined;
};

const buildCatalogCheckOptions = (
    options: Record<string, unknown>,
    configDefaults: NonNullable<VisConfig["update"]>,
    argument: string[],
): CatalogCheckOptions => {
    const target = (options.latest as boolean) ? "latest" : ((options.target as string) ?? configDefaults.target ?? "latest");

    if (!["latest", "minor", "patch"].includes(target)) {
        throw new Error(`Invalid target "${target}". Use: latest, minor, or patch.`);
    }

    return {
        exclude: [...toFilterArray(options.exclude as FilterOption), ...toFilterArray(configDefaults.exclude)],
        ignore: toFilterArray(configDefaults.ignore),
        include: [...toFilterArray(options.include as FilterOption), ...toFilterArray(configDefaults.include), ...argument],
        includeLocked: (options.includeLocked as boolean) || configDefaults.includeLocked || false,
        includePrerelease: (options.prerelease as boolean) || configDefaults.prerelease || false,
        minimumReleaseAge: configDefaults.minimumReleaseAge,
        minimumReleaseAgeExclude: configDefaults.minimumReleaseAgeExclude,
        packageMode: configDefaults.packageMode,
        security: (options.security as boolean) || (options.ai as boolean) || configDefaults.security || false,
        target: target as UpdateTarget,
    };
};

const logFilteredByTarget = (entries: OutdatedEntry[], logger: Console): void => {
    if (entries.length === 0) {
        return;
    }

    logger.info(
        `\n${yellow("\u26A0")} ${String(entries.length)} package${entries.length === 1 ? "" : "s"} skipped by target constraint (use --target latest to include):`,
    );

    for (const entry of entries) {
        logger.info(`    ${entry.packageName}  ${entry.currentRange} \u2192 ${entry.newRange}  (${entry.updateType})`);
    }
};

const writeFormattedOutput = (entries: OutdatedEntry[], failed: string[], format: string, logger: Console): void => {
    if (format === "json") {
        process.stdout.write(`${formatOutdatedJson({ checkedCount: 0, failed, filteredByTarget: [], ignored: [], outdated: entries })}\n`);
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

const executeCatalogUpdate = async (
    workspaceRoot: string,
    packageManager: CatalogPackageManager,
    visConfig: VisConfig,
    options: Record<string, unknown>,
    argument: string[],
    logger: Console,
): Promise<void> => {
    const configDefaults = visConfig.update ?? {};

    // Warn about flags that have no effect in catalog mode
    const ignoredCatalogFlags: [string, string][] = [
        ["global", "--global is not supported in catalog mode"],
        ["recursive", "--recursive is not needed in catalog mode (catalogs are workspace-level)"],
        ["filter", "--filter is not supported in catalog mode (use --include/--exclude instead)"],
        ["no-save", "--no-save is not supported in catalog mode"],
        ["workspace-root", "--workspace-root is not needed in catalog mode"],
        ["no-optional", "--no-optional is not supported in catalog mode"],
    ];

    for (const [flag, message] of ignoredCatalogFlags) {
        if (options[flag]) {
            logger.warn(`${yellow("\u26A0")} ${message}, ignoring.`);
        }
    }

    // Resolve minimumReleaseAge: vis config → PM-native config → undefined (disabled)
    const pmNativeAge = readPmNativeMinimumReleaseAge(workspaceRoot, packageManager);
    const effectiveAge = configDefaults.minimumReleaseAge ?? pmNativeAge;

    // Warn if both are set but differ
    if (configDefaults.minimumReleaseAge !== undefined && pmNativeAge !== undefined && configDefaults.minimumReleaseAge !== pmNativeAge) {
        const pmConfigFile = packageManager === "pnpm" ? "pnpm-workspace.yaml" : "package.json";

        logger.warn(
            `${yellow("\u26A0")} minimumReleaseAge mismatch: vis config = ${String(configDefaults.minimumReleaseAge)} min, `
            + `${pmConfigFile} = ${String(pmNativeAge)} min. Consider keeping them in sync.`,
        );
    }

    const npmrcConfig = loadNpmrc(workspaceRoot);
    const catalogs = readCatalogs(workspaceRoot, packageManager, {
        depFields: configDefaults.depFields,
        dev: options.dev as boolean | undefined,
        prod: options.prod as boolean | undefined,
    });

    if (catalogs.size === 0) {
        logger.info("No catalogs found.");

        return;
    }

    const resolvedDefaults = { ...configDefaults, minimumReleaseAge: effectiveAge };
    const checkOptions = buildCatalogCheckOptions(options, resolvedDefaults, argument);

    let totalDeps = 0;

    for (const deps of catalogs.values()) {
        totalDeps += deps.size;
    }

    const isTTY = Boolean(process.stdout.isTTY) && !isInCi;
    let progressInstance: ReturnType<typeof render> | undefined;

    const onProgress = isTTY
        ? (current: number, total: number): void => {
            if (progressInstance) {
                progressInstance.rerender(React.createElement(CheckProgressApp, { current, total }));
            } else {
                progressInstance = render(React.createElement(CheckProgressApp, { current, total }), {
                    interactive: true,
                    patchConsole: false,
                });
            }
        }
        : (current: number, total: number): void => {
            logger.info(`Checking ${String(current)}/${String(total)} dependencies...`);
        };

    if (!isTTY) {
        logger.info(`Checking ${String(totalDeps)} catalog dependencies...\n`);
    }

    const socketOptions = buildSocketOptions(visConfig.security?.socket);

    const { checkedCount, failed, filteredByTarget, ignored, outdated } = await checkOutdated(
        catalogs,
        checkOptions,
        npmrcConfig,
        onProgress,
        workspaceRoot,
        socketOptions,
        visConfig.security?.socket?.acceptedRisks,
    );

    if (progressInstance) {
        progressInstance.clear();
        progressInstance.unmount();
    }

    const upToDate = checkedCount - outdated.length - failed.length;

    if (failed.length > 0) {
        logger.warn(`Failed to fetch: ${failed.join(", ")}`);
    }

    if (ignored.length > 0) {
        logger.info(`Skipped ${String(ignored.length)} ignored package${ignored.length === 1 ? "" : "s"}: ${ignored.join(", ")}`);
    }

    if (!isTTY && checkedCount > outdated.length) {
        const totalCatalogEntries = [...catalogs.values()].reduce((sum, deps) => sum + deps.size, 0);
        const dedupeNote
            = totalCatalogEntries > checkedCount
                ? ` (${String(totalCatalogEntries)} catalog entries, ${String(totalCatalogEntries - checkedCount)} duplicates)`
                : "";

        logger.info(
            `Checked ${String(checkedCount)} unique packages${dedupeNote}: ${String(outdated.length)} outdated, ${String(upToDate)} up-to-date${
                failed.length > 0 ? `, ${String(failed.length)} failed` : ""
            }${filteredByTarget.length > 0 ? `, ${String(filteredByTarget.length)} skipped by target` : ""}`,
        );
    }

    if (outdated.length === 0) {
        if (filteredByTarget.length > 0) {
            logger.info(
                `All catalog dependencies are up to date within the current target.`
                + `\n${String(filteredByTarget.length)} package${filteredByTarget.length === 1 ? " has" : "s have"} newer versions available with --target latest:`
                + `\n${filteredByTarget.map((e) => `  ${e.packageName}  ${e.currentRange} \u2192 ${e.newRange}  (${e.updateType})`).join("\n")}`,
            );
        } else {
            logger.info("All catalog dependencies are up to date.");
        }

        return;
    }

    const format = (options.format as string) ?? configDefaults.format ?? "table";

    // AI analysis runs before dry-run check so it works in both modes
    let aiResult: AiAnalysisResult | undefined;

    if (options.ai) {
        const analysisType = validateAnalysisType((options.aiType as string | undefined) ?? "impact");

        aiResult = await runAiAnalysis(outdated, logger, visConfig.ai, analysisType);
    }

    const isDryRun = Boolean(options.dryRun);

    // Interactive TUI mode: TTY + table format
    if (isTTY && format === "table") {
        const store = new UpdateStore(outdated, aiResult ?? null);

        // Fetch changelog URLs if requested
        let changelogUrls: Map<string, string> | undefined;

        if (options.changelog) {
            logger.info("Fetching changelogs...");

            const changelogs = await fetchChangelogInfo(outdated);

            changelogUrls = new Map<string, string>();

            for (const info of changelogs) {
                const url = info.releaseUrl ?? info.repoUrl ?? info.npmUrl;

                if (url) {
                    changelogUrls.set(info.packageName, url);
                }
            }
        }

        const autoExitConfig = visConfig.tui?.autoExit ?? false;
        const autoExitSeconds = autoExitConfig === true ? 3 : typeof autoExitConfig === "number" ? autoExitConfig : 0;

        const instance = render(
            React.createElement(VisUpdateApp, {
                autoExitSeconds,
                changelogUrls,
                checkedCount,
                filteredOutEntries: filteredByTarget,
                isDryRun,
                store,
                totalCatalogEntries: totalDeps,
            }),
            {
                alternateScreen: true,
                exitOnCtrlC: false,
                interactive: true,
                patchConsole: true,
            },
        );

        const exitResult = await instance.waitUntilExit();

        // Print post-exit summary
        const columns = process.stdout.columns || 80;

        process.stdout.write("\n");

        for (const entry of outdated) {
            const hasSecurityIssue = entry.vulnerabilities?.length || (entry.socketReport && entry.socketReport.alerts.length > 0);
            const isAck = Boolean(entry.acceptedRisk);
            const icon = hasSecurityIssue ? (isAck ? "\u2713" : "\u26A0") : "\u2713";
            const iconColor = isAck ? "gray" : entry.updateType === "major" ? "red" : entry.updateType === "minor" ? "yellow" : "green";
            const socketOverall = entry.socketReport?.score.overall;
            const scoreSuffix = socketOverall === undefined ? "" : ` [${String(Math.round(socketOverall * 100))}%]`;
            const socketColorName = socketOverall === undefined ? undefined : scoreColor(socketOverall);

            process.stdout.write(
                `${renderToString(
                    React.createElement(
                        Text,
                        null,
                        "   ",
                        React.createElement(Text, { color: iconColor }, icon),
                        `  ${entry.packageName}  ${entry.currentRange} \u2192 ${entry.newRange}`,
                        React.createElement(Text, { dimColor: true }, `  ${entry.updateType}`),
                        socketColorName ? React.createElement(Text, { color: socketColorName }, scoreSuffix) : null,
                    ),
                    { columns },
                )}\n`,
            );
        }

        process.stdout.write("\n");
        logger.info(formatSummary(outdated));

        if (checkedCount > outdated.length) {
            const totalCatalogEntries = [...catalogs.values()].reduce((sum, deps) => sum + deps.size, 0);
            const dedupeNote
                = totalCatalogEntries > checkedCount
                    ? ` (${String(totalCatalogEntries)} catalog entries, ${String(totalCatalogEntries - checkedCount)} duplicates)`
                    : "";

            logger.info(
                `  Checked ${String(checkedCount)} unique packages${dedupeNote}: ${String(upToDate)} up-to-date${
                    failed.length > 0 ? `, ${String(failed.length)} failed` : ""
                }`,
            );
        }

        if (filteredByTarget.length > 0) {
            process.stdout.write("\n");

            const skippedLabel = `${String(filteredByTarget.length)} package${filteredByTarget.length === 1 ? "" : "s"} skipped by target constraint (use --target latest to include):`;

            process.stdout.write(`${renderToString(React.createElement(Text, { color: "yellow" }, `  ${skippedLabel}`), { columns })}\n`);

            for (const entry of filteredByTarget) {
                process.stdout.write(
                    `${renderToString(
                        React.createElement(
                            Text,
                            null,
                            "     ",
                            React.createElement(Text, { dimColor: true }, entry.packageName),
                            `  ${entry.currentRange} \u2192 ${entry.newRange}`,
                            React.createElement(Text, { dimColor: true }, `  ${entry.updateType}`),
                        ),
                        { columns },
                    )}\n`,
                );
            }
        }

        // If user selected entries to apply (exitResult is the checked entries array)
        const toApply = Array.isArray(exitResult) ? (exitResult as OutdatedEntry[]) : [];

        if (toApply.length > 0 && !isDryRun) {
            logger.info(`\nApplying ${String(toApply.length)} updates...\n`);

            const mergedOptions = { ...options, install: options.install ?? configDefaults.install };

            await applyCatalogAndInstall(workspaceRoot, packageManager, toApply, mergedOptions, logger);
        }

        return;
    }

    // Static output mode (non-TTY, CI, json, minimal)
    if (isDryRun) {
        if (format === "json") {
            const output: Record<string, unknown> = { failed, filteredByTarget, ignored, outdated };

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

            logFilteredByTarget(filteredByTarget, logger);
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
    logFilteredByTarget(filteredByTarget, logger);

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
        noOptional: options.noOptional as boolean,
        noSave: options.noSave as boolean,
        packages: argument,
        prod: options.prod as boolean,
        recursive: options.recursive as boolean,
        workspaceRoot: options.workspaceRoot as boolean,
    };

    const { command, warnings } = resolveUpdateCommand(packageManager, version, updateOptions);

    for (const warning of warnings) {
        logger.warn(warning);
    }

    const fullCommand = `${command.bin} ${command.args.join(" ")}`.trim();

    if (options.dryRun) {
        logger.info(`Would run: ${fullCommand}`);

        return;
    }

    logger.info(`Running: ${fullCommand}`);

    try {
        execSync(fullCommand, {
            cwd: workspaceRoot,
            env: process.env,
            stdio: "inherit",
        });
    } catch (error: unknown) {
        const execError = error as { status?: number };
        const exitCode = execError.status ?? 1;

        logger.error(`\n${red("\u2716")} Update failed (exit code ${String(exitCode)})`);
        logger.error(`  Command: ${fullCommand}`);
        logger.error(`  Directory: ${workspaceRoot}\n`);

        process.exitCode = exitCode;
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
    execute: async ({ argument: rawArgument, logger, options, visConfig, workspaceRoot: wsRoot }) => {
        if (!wsRoot) {
            throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
        }

        let argument = rawArgument;

        const workspaceRoot = wsRoot;
        const { packageManager } = findPackageManagerSync(workspaceRoot);

        // Typosquat check
        if (!options.noTyposquatCheck) {
            if (argument.length > 0) {
                // Explicit package arguments: offer name correction
                const parsed = argument.map((a: string) => parsePackageArgument(a));
                const allowlist = visConfig?.security?.typosquatAllowlist;
                const result = await runTyposquatCheck(
                    parsed.map((p) => p.name),
                    allowlist,
                );

                if (!result.ok) {
                    process.exitCode = 1;

                    return;
                }

                // Rebuild args with corrected names, preserving version specifiers
                argument = parsed.map((p, i) => {
                    const corrected = result.packages[i];

                    if (corrected !== p.name) {
                        return p.versionSpec ? `${corrected}@${p.versionSpec}` : (corrected ?? "");
                    }

                    return argument[i] ?? "";
                });
            } else {
                // No explicit args: scan package.json deps for typosquats
                const shouldContinue = await scanDepsForTyposquats(workspaceRoot, visConfig?.security?.typosquatAllowlist);

                if (!shouldContinue) {
                    process.exitCode = 1;

                    return;
                }
            }
        }

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
        const useCatalogMode = !options.noCatalog && hasCatalogs(workspaceRoot, packageManager);

        if (useCatalogMode) {
            await executeCatalogUpdate(workspaceRoot, packageManager as CatalogPackageManager, visConfig ?? {}, options, argument, logger);
        } else {
            const version = getPackageManagerVersion(packageManager);

            executePmWrapper(workspaceRoot, packageManager, version, options, argument, logger);
        }
    },
    group: "Dependencies",
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
            alias: "l",
            defaultValue: false,
            description: "Include packages with pinned/exact versions (no ^ or ~ prefix)",
            name: "include-locked",
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
        {
            defaultValue: false,
            description: "Skip typosquat name check for package arguments",
            name: "no-typosquat-check",
            type: Boolean,
        },
    ],
};

export default update;
