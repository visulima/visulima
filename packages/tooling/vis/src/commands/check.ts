import { spawnSync } from "node:child_process";

import type { Command } from "@visulima/cerebro";
import { findPackageManagerSync } from "@visulima/package";

import { formatAiAnalysis, runAiAnalysis, validateAnalysisType } from "../ai-analysis";
import type { CatalogCheckOptions, UpdateTarget } from "../catalog";
import { checkOutdated, formatOutdatedMinimal, formatOutdatedTable, formatSummary, loadNpmrc, readCatalogs, toFilterArray } from "../catalog";
import { fail, info, pass, success } from "../output";
import { detectPm } from "../pm-runner";
import { previewPnpmSync, printSecurityReport } from "../security";

// ── Code quality runner ──────────────────────────────────────────────

interface QualityStep {
    args: string[];
    bin: string;
    name: string;
}

/**
 * Runs code quality checks sequentially with fail-fast.
 * Returns true if all checks pass.
 */
const runQualityChecks = (
    steps: QualityStep[],
    cwd: string,
    fix: boolean,
    files: string[],
): boolean => {
    for (const step of steps) {
        const args = [...step.args];

        if (fix && step.name !== "type-check") {
            args.push("--fix");
        }

        if (files.length > 0 && step.name !== "type-check") {
            args.push(...files);
        }

        const start = Date.now();
        const result = spawnSync(step.bin, args, { cwd, stdio: "inherit" });
        const elapsed = Date.now() - start;

        if (result.status !== 0) {
            fail(`${step.name} failed (${elapsed}ms)`);

            return false;
        }

        pass(`${step.name} passed (${elapsed}ms)`);
    }

    return true;
};

const check: Command = {
    alias: "c",
    argument: {
        description: "Specific packages to check, or file paths for code quality mode",
        name: "packages",
        type: String,
    },
    description: "Check code quality (format, lint, typecheck) and/or outdated dependencies",
    examples: [
        // Code quality mode
        ["vis check --fix", "Auto-fix format and lint issues"],
        ["vis check --no-fmt", "Skip formatting, run lint + typecheck only"],
        ["vis check --no-lint", "Skip linting, run format + typecheck only"],
        ["vis check --no-type-check", "Skip type checking"],
        ["vis check --fix src/index.ts", "Fix specific files"],
        // Outdated dependency mode
        ["vis check --deps", "Check all catalog dependencies for updates"],
        ["vis check --deps react", "Check specific packages"],
        ["vis check --deps --target minor", "Only show minor/patch updates"],
        ["vis check --deps --security", "Include OSV.dev vulnerability scan"],
        // Security config mode
        ["vis check --security-config", "Audit supply chain security settings"],
    ],
    // eslint-disable-next-line sonarjs/cognitive-complexity
    execute: async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }) => {
        if (!wsRoot) {
            throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
        }

        const workspaceRoot = wsRoot;

        // ── Security config audit mode ───────────────────────────────
        if (options["security-config"]) {
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
            }

            if (!options.deps && !options.fmt && !options.lint && !options["type-check"]) {
                return;
            }
        }

        // ── Code quality mode (default when no --deps flag) ──────────
        const isDepsMode = (options.deps as boolean) || false;
        const hasFmtOrLintFlag = options.fmt !== undefined || options.lint !== undefined || options["type-check"] !== undefined || options.fix !== undefined;

        // Default behavior: if no --deps and no explicit quality flags, run code quality
        const runQuality = !isDepsMode || hasFmtOrLintFlag;

        if (runQuality && !isDepsMode) {
            const fmtEnabled = options.fmt !== false; // default true
            const lintEnabled = options.lint !== false; // default true
            const typeCheckEnabled = options["type-check"] !== false; // default true
            const fix = (options.fix as boolean) || false;
            const files = (argument as string[]) || [];

            if (!fmtEnabled && !lintEnabled && !typeCheckEnabled) {
                throw new Error("Cannot disable all checks. At least one of --fmt, --lint, or --type-check must be enabled.");
            }

            const steps: QualityStep[] = [];

            // Format check (runs first - fastest)
            if (fmtEnabled) {
                steps.push({
                    args: fix ? ["run", "lint:prettier:fix"] : ["run", "lint:prettier"],
                    bin: "pnpm",
                    name: "format",
                });
            }

            // Lint check
            if (lintEnabled) {
                steps.push({
                    args: fix ? ["run", "lint:eslint:fix"] : ["run", "lint:eslint"],
                    bin: "pnpm",
                    name: "lint",
                });
            }

            // Type check (runs last - slowest)
            if (typeCheckEnabled) {
                steps.push({
                    args: ["run", "lint:types"],
                    bin: "pnpm",
                    name: "type-check",
                });
            }

            const allPassed = runQualityChecks(steps, workspaceRoot, fix, files);

            if (!allPassed) {
                process.exitCode = 1;

                if (fix) {
                    info("\nSome issues could not be auto-fixed. Review the errors above.");
                } else {
                    info("\nRun 'vis check --fix' to auto-fix format and lint issues.");
                }
            }

            // If no --deps flag, we're done after code quality
            if (!isDepsMode) {
                return;
            }
        }

        // ── Outdated dependency check (--deps mode) ──────────────────
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
            include: [...toFilterArray(options.include as string | string[] | undefined), ...toFilterArray(configDefaults.include), ...(argument as string[])],
            includePrerelease: (options.prerelease as boolean) || configDefaults.prerelease || false,
            security: (options.security as boolean) || (options.ai as boolean) || configDefaults.security || false,
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
        const analysisType = validateAnalysisType((options["ai-type"] as string | undefined) ?? "impact");
        const aiResult = options.ai ? await runAiAnalysis(outdated, logger, visConfig?.ai, analysisType) : undefined;

        if (format === "json") {
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

        if (options["exit-code"] && outdated.length > 0) {
            process.exitCode = 1;
        }
    },
    name: "check",
    options: [
        // Code quality options
        {
            defaultValue: false,
            description: "Auto-fix format and lint issues",
            name: "fix",
            type: Boolean,
        },
        {
            defaultValue: true,
            description: "Run format checking (use --no-fmt to skip)",
            name: "fmt",
            type: Boolean,
        },
        {
            defaultValue: true,
            description: "Run linting (use --no-lint to skip)",
            name: "lint",
            type: Boolean,
        },
        {
            defaultValue: true,
            description: "Run TypeScript type checking (use --no-type-check to skip)",
            name: "type-check",
            type: Boolean,
        },
        // Dependency check options
        {
            defaultValue: false,
            description: "Check for outdated dependencies (instead of code quality)",
            name: "deps",
            type: Boolean,
        },
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
            defaultValue: false,
            description: "Audit supply chain security settings",
            name: "security-config",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Sync security settings to pnpm-workspace.yaml (pnpm only)",
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
            description: "Check only devDependencies (deps mode)",
            name: "dev",
            type: Boolean,
        },
        {
            alias: "P",
            defaultValue: false,
            description: "Check only dependencies (deps mode)",
            name: "prod",
            type: Boolean,
        },
    ],
};

export default check;
