import type { Command } from "@visulima/cerebro";
import { findPackageManagerSync } from "@visulima/package";
import { render, renderToString, Text } from "@visulima/tui";
import isInCi from "is-in-ci";
import React from "react";

import { formatAiAnalysis, runAiAnalysis, validateAnalysisType } from "../ai-analysis";
import type { CatalogCheckOptions, UpdateTarget } from "../catalog";
import { checkOutdated, formatOutdatedMinimal, formatOutdatedTable, formatSummary, loadNpmrc, readCatalogs, toFilterArray } from "../catalog";
import { info, success } from "../output";
import { detectPm } from "../pm-runner";
import { previewPnpmSync, printSecurityReport } from "../security";
import { buildSocketOptions, scoreColor } from "../socket-security";
import CheckProgressApp from "../tui/components/CheckProgressApp";
import { UpdateStore } from "../tui/components/update/UpdateStore";
import VisUpdateApp from "../tui/components/update/VisUpdateApp";

const check: Command = {
    group: "Security & Health",
    alias: ["c", "outdated"],
    argument: {
        description: "Specific packages to check (checks all if omitted)",
        name: "packages",
        type: String,
    },
    description: "Check for outdated dependencies, security vulnerabilities, and supply chain settings",
    examples: [
        ["vis check", "Check all catalog dependencies"],
        ["vis check react", "Check specific packages"],
        ["vis check --target minor", "Only show minor/patch updates"],
        ["vis check --exclude '@types/*'", "Exclude packages by pattern"],
        ["vis check --no-security", "Skip vulnerability scanning"],
        ["vis check --security-config", "Audit supply chain security settings"],
        ["vis check --security-config --sync", "Sync security config to pnpm-workspace.yaml"],
    ],
    execute: async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }) => {
        if (!wsRoot) {
            throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
        }

        const workspaceRoot = wsRoot;

        // ── Security config audit mode ───────────────────────────────
        if (options.securityConfig) {
            const pm = detectPm(workspaceRoot);

            printSecurityReport(visConfig ?? {}, pm.name);

            if (options.sync && pm.name === "pnpm") {
                const synced = previewPnpmSync(visConfig ?? {});

                if (synced.length > 0) {
                    info("\nSettings that would sync to pnpm-workspace.yaml:");

                    for (const s of synced) {
                        success(`  ${s}`);
                    }
                } else {
                    info("No security settings to sync.");
                }
            } else if (options.sync && pm.name !== "pnpm") {
                info(`--sync is only available for pnpm projects. Your project uses ${pm.name}.`);
                info("vis enforces security settings at the vis layer for non-pnpm projects.");
            }

            // If only --security-config was passed (no outdated check), return
            if (!options.security && !argument?.length) {
                return;
            }
        }

        // ── Outdated dependency check ────────────────────────────────
        const { packageManager } = findPackageManagerSync(workspaceRoot);

        const npmrcConfig = loadNpmrc(workspaceRoot);
        const configDefaults = visConfig?.update ?? {};
        const catalogs = readCatalogs(workspaceRoot, packageManager, {
            dev: options.dev as boolean | undefined,
            prod: options.prod as boolean | undefined,
        });

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
            ignore: toFilterArray(configDefaults.ignore),
            include: [...toFilterArray(options.include as string | string[] | undefined), ...toFilterArray(configDefaults.include), ...argument],
            includeLocked: Boolean(options.includeLocked),
            includePrerelease: (options.prerelease as boolean) || configDefaults.prerelease || false,
            security: !options.noSecurity,
            target: target as UpdateTarget,
        };

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
            logger.info(`Checking ${String(totalDeps)} catalog dependencies against npm registry...\n`);
        }

        const socketOptions = buildSocketOptions(visConfig?.security?.socket);

        const { failed, outdated } = await checkOutdated(
            catalogs,
            checkOptions,
            npmrcConfig,
            onProgress,
            workspaceRoot,
            socketOptions,
            visConfig?.security?.socket?.acceptedRisks,
        );

        if (progressInstance) {
            progressInstance.clear();
            progressInstance.unmount();
        }

        if (failed.length > 0) {
            logger.warn(`Failed to fetch: ${failed.join(", ")}`);
        }

        if (outdated.length === 0) {
            logger.info("All catalog dependencies are up to date.");

            return;
        }

        const format = (options.format as string) ?? configDefaults.format ?? "table";
        const analysisType = validateAnalysisType((options.aiType as string | undefined) ?? "impact");
        const aiResult = options.ai ? await runAiAnalysis(outdated, logger, visConfig?.ai, analysisType) : undefined;

        // Interactive TUI mode: TTY + table format
        if (isTTY && format === "table") {
            const store = new UpdateStore(outdated, aiResult ?? null);

            const autoExitConfig = visConfig?.tui?.autoExit ?? false;
            const autoExitSeconds = autoExitConfig === true ? 3 : typeof autoExitConfig === "number" ? autoExitConfig : 0;

            const instance = render(
                React.createElement(VisUpdateApp, {
                    autoExitSeconds,
                    isDryRun: true,
                    store,
                }),
                {
                    alternateScreen: true,
                    exitOnCtrlC: false,
                    interactive: true,
                    patchConsole: true,
                },
            );

            await instance.waitUntilExit();

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
        } else if (format === "json") {
            const output: Record<string, unknown> = { failed, outdated };

            if (aiResult) {
                output.aiAnalysis = aiResult;
            }

            process.stdout.write(`${JSON.stringify(output, undefined, 2)}\n`);
        } else if (format === "minimal") {
            process.stdout.write(`${formatOutdatedMinimal(outdated)}\n`);
        } else {
            formatOutdatedTable(outdated, logger);
            logger.info(formatSummary(outdated));

            if (aiResult) {
                logger.info("");
                logger.info(formatAiAnalysis(aiResult));
            }
        }

        if (options.exitCode && outdated.length > 0) {
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
            description: "Skip security vulnerability scanning",
            name: "no-security",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Audit supply chain security settings",
            name: "security-config",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Sync security settings to pnpm-workspace.yaml (pnpm only, requires --security-config)",
            name: "sync",
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
        {
            defaultValue: false,
            description: "Run AI analysis on outdated packages",
            name: "ai",
            type: Boolean,
        },
        {
            description: "AI analysis type: impact, security, compatibility, or recommend",
            name: "ai-type",
            type: String,
        },
        {
            alias: "D",
            defaultValue: false,
            description: "Check only devDependencies (npm/yarn mode)",
            name: "dev",
            type: Boolean,
        },
        {
            alias: "P",
            defaultValue: false,
            description: "Check only dependencies (npm/yarn mode)",
            name: "prod",
            type: Boolean,
        },
    ],
};

export default check;
