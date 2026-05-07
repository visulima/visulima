import { execFileSync } from "node:child_process";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { red, yellow } from "@visulima/colorize";
import { isAccessibleSync } from "@visulima/fs";
import { readTomlSync } from "@visulima/fs/toml";
import { readYamlSync } from "@visulima/fs/yaml";
import { findPackageManagerSync, getPackageManagerVersion } from "@visulima/package";
import { join } from "@visulima/path";
import { render, renderToString, Text } from "@visulima/tui";
import isInCi from "is-in-ci";
import React from "react";

import type { AiAnalysisResult } from "../../ai/ai-analysis";
import { formatAiAnalysis, runAiAnalysis, validateAnalysisType } from "../../ai/ai-analysis";
import type { VisConfig } from "../../config/workspace";
import type { UpdateCommandOptions } from "../../pm/package-manager";
import { resolveUpdateCommand } from "../../pm/package-manager";
import { resolveInstaller } from "../../pm/pm-runner";
import { buildSocketOptions, scoreColor } from "../../security/socket-security";
import { runTyposquatCheck, scanDepsForTyposquats } from "../../security/typosquats";
import CheckProgressApp from "../../tui/components/check-progress-app";
import { UpdateStore } from "../../tui/components/update/update-store";
import VisUpdateApp from "../../tui/components/update/vis-update-app";
import type { CatalogCheckOptions, NpmrcConfig, OutdatedEntry, UpdateTarget } from "../../util/catalog";
import {
    applyCatalogUpdates,
    checkOutdated,
    collectInternalOutdated,
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
} from "../../util/catalog";
import { parsePackageArgument } from "../../util/utils";
import type { UpdateOptions } from "./index";

type CatalogPackageManager = "bun" | "npm" | "pnpm" | "yarn";
type FilterOption = string | string[] | undefined;

interface PmNativeMinimumReleaseAge {
    /**
     * Package names/patterns exempt from the minimum-release-age check.
     * pnpm spells this `minimumReleaseAgeExclude` (singular) under
     * `pnpm-workspace.yaml`; bun spells it `minimumReleaseAgeExcludes`
     * (plural) under `bunfig.toml [install]`. We normalise to the
     * vis-internal singular shape.
     */
    excludes?: string[];
    /** Value in minutes; undefined when the PM-native config doesn't pin it. */
    minutes?: number;
}

/**
 * Reads `minimumReleaseAge` (and the excludes list) from the package
 * manager's native config. Returns an object with both fields so callers
 * can merge them into vis-config defaults uniformly.
 *
 * - pnpm: `pnpm-workspace.yaml` top-level.
 * - bun: `bunfig.toml [install]` — **not** `package.json`. Bun's installer
 *   knobs (registry, scopes, lockfile, minimumReleaseAge, …) all live
 *   under `[install]` per https://bun.sh/docs/runtime/bunfig#install.
 */
export const readPmNativeMinimumReleaseAge = (workspaceRoot: string, packageManager: string): PmNativeMinimumReleaseAge => {
    try {
        if (packageManager === "pnpm") {
            const yamlPath = join(workspaceRoot, "pnpm-workspace.yaml");

            if (isAccessibleSync(yamlPath)) {
                const data = readYamlSync(yamlPath) as
                    | {
                        minimumReleaseAge?: number;
                        minimumReleaseAgeExclude?: string[];
                    }
                    | undefined;

                return {
                    excludes: Array.isArray(data?.minimumReleaseAgeExclude) ? data.minimumReleaseAgeExclude : undefined,
                    minutes: typeof data?.minimumReleaseAge === "number" ? data.minimumReleaseAge : undefined,
                };
            }
        } else if (packageManager === "bun") {
            const tomlPath = join(workspaceRoot, "bunfig.toml");

            if (isAccessibleSync(tomlPath)) {
                const data = readTomlSync(tomlPath) as
                    | {
                        install?: {
                            minimumReleaseAge?: number;
                            minimumReleaseAgeExcludes?: string[];
                        };
                    }
                    | undefined;

                return {
                    excludes: Array.isArray(data?.install?.minimumReleaseAgeExcludes) ? data.install.minimumReleaseAgeExcludes : undefined,
                    minutes: typeof data?.install?.minimumReleaseAge === "number" ? data.install.minimumReleaseAge : undefined,
                };
            }
        }
    } catch {
        // Non-critical: if parsing fails, skip the sync check.
    }

    return {};
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

    const maxConcurrentRequestsFlag = options.maxConcurrentRequests;
    const maxConcurrentRequests
        = typeof maxConcurrentRequestsFlag === "number" && maxConcurrentRequestsFlag > 0 ? maxConcurrentRequestsFlag : configDefaults.maxConcurrentRequests;

    const releaseChannelFlag = typeof options.releaseChannel === "string" ? options.releaseChannel.toLowerCase() : undefined;

    if (releaseChannelFlag !== undefined && !["any", "same", "stable"].includes(releaseChannelFlag)) {
        throw new Error(`Invalid --release-channel "${String(options.releaseChannel)}". Use: any, same, or stable.`);
    }

    const releaseChannel = (releaseChannelFlag ?? configDefaults.releaseChannel) as "any" | "same" | "stable" | undefined;

    return {
        exclude: [...toFilterArray(options.exclude as FilterOption), ...toFilterArray(configDefaults.exclude)],
        ignore: toFilterArray(configDefaults.ignore),
        include: [...toFilterArray(options.include as FilterOption), ...toFilterArray(configDefaults.include), ...argument],
        includeLocked: (options.includeLocked as boolean) || configDefaults.includeLocked || false,
        includePrerelease: (options.prerelease as boolean) || configDefaults.prerelease || false,
        maxConcurrentRequests,
        minimumReleaseAge: configDefaults.minimumReleaseAge,
        minimumReleaseAgeExclude: configDefaults.minimumReleaseAgeExclude,
        packageMode: configDefaults.packageMode,
        releaseChannel,
        security: (options.security as boolean) || (options.ai as boolean) || configDefaults.security || false,
        target: target as UpdateTarget,
    };
};

const logFilteredByTarget = (entries: OutdatedEntry[], logger: Console): void => {
    if (entries.length === 0) {
        return;
    }

    logger.info(
        `\n${yellow("⚠")} ${String(entries.length)} package${entries.length === 1 ? "" : "s"} skipped by target constraint (use --target latest to include):`,
    );

    for (const entry of entries) {
        logger.info(`    ${entry.packageName}  ${entry.currentRange} → ${entry.newRange}  (${entry.updateType})`);
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
    npmrcConfig?: NpmrcConfig,
    useEditorconfig?: boolean,
): Promise<void> => {
    const backupPath = applyCatalogUpdates(workspaceRoot, toApply, packageManager, true, { useEditorconfig });
    const targetFile = packageManager === "pnpm" ? "pnpm-workspace.yaml" : "package.json";

    logger.info(`\nUpdated ${targetFile}`);

    if (backupPath) {
        logger.info(`Backup saved to ${backupPath}`);
    }

    if (options.changelog) {
        logger.info("\nFetching changelogs...");

        const changelogs = await fetchChangelogInfo(toApply, undefined, npmrcConfig);

        for (const info of changelogs) {
            const url = info.releaseUrl ?? info.repoUrl ?? info.npmUrl;

            logger.info(`  ${info.packageName}: ${url}`);
        }
    }

    if (options.install ?? true) {
        const installBin = packageManager;
        const installArgs = ["install"];

        logger.info(`Running ${installBin} ${installArgs.join(" ")}...\n`);

        try {
            execFileSync(installBin, installArgs, {
                cwd: workspaceRoot,
                env: process.env,
                stdio: "inherit",
            });
        } catch {
            logger.warn(`${installBin} ${installArgs.join(" ")} failed. You may need to run it manually.`);
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
            logger.warn(`${yellow("⚠")} ${message}, ignoring.`);
        }
    }

    // Resolve minimumReleaseAge: vis config → PM-native config → undefined (disabled)
    const { excludes: pmNativeExcludes, minutes: pmNativeAge } = readPmNativeMinimumReleaseAge(workspaceRoot, packageManager);
    const effectiveAge = configDefaults.minimumReleaseAge ?? pmNativeAge;
    const effectiveExcludes = configDefaults.minimumReleaseAgeExclude ?? pmNativeExcludes;

    // Warn if both are set but differ
    if (configDefaults.minimumReleaseAge !== undefined && pmNativeAge !== undefined && configDefaults.minimumReleaseAge !== pmNativeAge) {
        const pmConfigFile = packageManager === "pnpm" ? "pnpm-workspace.yaml" : "bunfig.toml";

        logger.warn(
            `${yellow("⚠")} minimumReleaseAge mismatch: vis config = ${String(configDefaults.minimumReleaseAge)} min, `
            + `${pmConfigFile} = ${String(pmNativeAge)} min. Consider keeping them in sync.`,
        );
    }

    const npmrcConfig = loadNpmrc(workspaceRoot);
    const includeInternal = options["include-internal"] as boolean | undefined;
    const includePeer = options.peer as boolean | undefined;
    const catalogs = readCatalogs(workspaceRoot, packageManager, {
        depFields: configDefaults.depFields,
        dev: options.dev as boolean | undefined,
        includeInternal,
        peer: includePeer,
        prod: options.prod as boolean | undefined,
    });

    if (catalogs.size === 0) {
        logger.info("No catalogs found.");

        return;
    }

    const resolvedDefaults = { ...configDefaults, minimumReleaseAge: effectiveAge, minimumReleaseAgeExclude: effectiveExcludes };
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
                // Leading newline keeps the spinner from colliding with any
                // prior pail.warn / security messages emitted in beforeCommand.
                process.stdout.write("\n");
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

    // Internal workspace deps lag behind their local source-of-truth versions
    // when one workspace package bumps but consumers still pin the previous
    // alpha/rc. `checkOutdated` filters internal names out (the registry
    // doesn't host them yet), so we resolve them here against the local
    // package.json versions and merge into `outdated` for the same apply path.
    //
    // Skipped when `--include-internal` is on: that flag routes those names
    // through the registry pass, and running both produces duplicates where
    // the dedup below would silently prefer whichever pass landed first.
    const internal = includeInternal
        ? { ignored: [] as string[], outdated: [] as typeof outdated }
        : collectInternalOutdated(workspaceRoot, {
            depFields: configDefaults.depFields,
            dev: options.dev as boolean | undefined,
            exclude: checkOptions.exclude,
            ignore: checkOptions.ignore,
            include: checkOptions.include,
            packageMode: checkOptions.packageMode,
            peer: includePeer,
            prod: options.prod as boolean | undefined,
            target: checkOptions.target,
        });

    if (internal.outdated.length > 0) {
        const existingKeys = new Set(outdated.map((e) => `${e.catalogName}|${e.packageName}`));

        for (const entry of internal.outdated) {
            if (!existingKeys.has(`${entry.catalogName}|${entry.packageName}`)) {
                outdated.push(entry);
            }
        }
    }

    if (internal.ignored.length > 0) {
        for (const name of internal.ignored) {
            if (!ignored.includes(name)) {
                ignored.push(name);
            }
        }
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
                + `\n${filteredByTarget.map((e) => `  ${e.packageName}  ${e.currentRange} → ${e.newRange}  (${e.updateType})`).join("\n")}`,
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

            const changelogs = await fetchChangelogInfo(outdated, undefined, npmrcConfig);

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
            const icon = hasSecurityIssue ? (isAck ? "✓" : "⚠") : "✓";
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
                        `  ${entry.packageName}  ${entry.currentRange} → ${entry.newRange}`,
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
                            `  ${entry.currentRange} → ${entry.newRange}`,
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

            await applyCatalogAndInstall(workspaceRoot, packageManager, toApply, mergedOptions, logger, npmrcConfig, visConfig.editorconfig ?? true);
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

    await applyCatalogAndInstall(workspaceRoot, packageManager, toApply, mergedOptions, logger, npmrcConfig);
};

const executePmWrapper = (
    workspaceRoot: string,
    packageManager: "aube" | "bun" | "deno" | "npm" | "pnpm" | "yarn",
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
        noOptional: options.optional === false,
        noSave: options.save === false,
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
        execFileSync(command.bin, command.args, {
            cwd: workspaceRoot,
            env: process.env,
            stdio: "inherit",
        });
    } catch (error: unknown) {
        const execError = error as { status?: number };
        const exitCode = execError.status ?? 1;

        logger.error(`\n${red("✖")} Update failed (exit code ${String(exitCode)})`);
        logger.error(`  Command: ${fullCommand}`);
        logger.error(`  Directory: ${workspaceRoot}\n`);

        process.exitCode = exitCode;
    }
};

const execute = async ({ argument: rawArgument, logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, UpdateOptions>): Promise<void> => {
    if (!wsRoot) {
        throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
    }

    let argument = rawArgument;

    const workspaceRoot = wsRoot;
    const { packageManager } = findPackageManagerSync(workspaceRoot);

    // Typosquat check
    if ((options as Record<string, unknown>).typosquatCheck !== false) {
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

    // Catalog mode: pnpm/bun with catalogs detected, unless --no-catalog.
    // Catalog work always uses the lockfile-detected PM (pnpm/bun) because
    // catalog manipulation is PM-format-specific. Aube cannot host catalogs
    // on its own — it inherits whatever pnpm-workspace.yaml the project has.
    const useCatalogMode = (options as Record<string, unknown>).catalog !== false && hasCatalogs(workspaceRoot, packageManager);

    if (useCatalogMode) {
        await executeCatalogUpdate(workspaceRoot, packageManager, visConfig ?? {}, options, argument, logger);
    } else {
        // Non-catalog updates honor `install.backend` so users who opted
        // into aube get `aube update` instead of the lockfile-detected PM.
        const installer = resolveInstaller(workspaceRoot, { configBackend: visConfig?.install?.backend, configCorepack: visConfig?.install?.corepack });
        const installerVersion = installer.name === "aube" ? "" : getPackageManagerVersion(installer.name);

        executePmWrapper(workspaceRoot, installer.name, installerVersion, options, argument, logger);
    }
};

export default execute as CommandExecute<Toolbox>;
