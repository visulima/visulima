import type { Command } from "@visulima/cerebro";

import { detectPackageManager } from "../hook/migrate";
import { migrateDeps } from "./deps";
import { migrateLintStaged } from "./lint-staged";
import { migrateMoon } from "./moon";
import { migrateNx } from "./nx";
import { migrateTurborepo } from "./turborepo";
import type { MigrationReport } from "./types";
import { createMigrationReport } from "./types";

interface Logger {
    info: (message: string) => void;
    warn: (message: string) => void;
}

/**
 * Print migration summary report.
 */
const printSummary = (report: MigrationReport, logger: Logger): void => {
    logger.info("── Migration Summary ──");

    const counts: [string, number][] = [
        ["Staged configs merged into vis.config.ts", report.mergedStagedConfigCount],
        ["Lint-staged configs inlined", report.inlinedLintStagedConfigCount],
        ["Config files removed", report.removedConfigCount],
        ["Packages removed", report.removedPackageCount],
        ["Scripts rewritten", report.rewrittenScriptCount],
    ];

    for (const [label, count] of counts) {
        if (count > 0) {
            logger.info(`  ${label}: ${String(count)}`);
        }
    }

    if (report.gitHooksConfigured) {
        logger.info("  Pre-commit hook updated to use vis staged");
    }

    if (report.warnings.length > 0) {
        logger.info("");
        logger.warn("Warnings:");

        for (const warning of report.warnings) {
            logger.warn(`  - ${warning}`);
        }
    }

    if (report.manualSteps.length > 0) {
        logger.info("");
        logger.info("Manual steps required:");

        for (const step of report.manualSteps) {
            logger.info(`  - ${step}`);
        }
    }
};

const migrate: Command = {
    group: "Scaffold & Config",
    argument: {
        description: "Migration type: all, deps, lint-staged",
        name: "type",
        type: String,
    },
    description: "Migrate from other tools (husky, lint-staged, turborepo, nx, moon) to vis",
    examples: [
        ["vis migrate", "Run all built-in migrations (deps + lint-staged)"],
        ["vis migrate deps", "Migrate package dependencies and scripts"],
        ["vis migrate lint-staged", "Migrate lint-staged config to vis.config.ts"],
        ["vis migrate turborepo", "Translate turbo.json into vis.config.ts"],
        ["vis migrate nx", "Translate nx.json into vis.config.ts"],
        ["vis migrate moon", "Translate .moon/tasks.yml into vis.config.ts"],
        ["vis migrate turborepo --dry-run", "Preview changes without applying"],
    ],
    execute: async ({ argument, logger, options, visConfig, workspaceRoot }) => {
        const action = (argument[0] as string | undefined) ?? "all";
        const dryRun = Boolean(options.dryRun);
        const root = workspaceRoot ?? process.cwd();
        const config = (visConfig ?? {}) as Record<string, unknown>;
        const packageManager = detectPackageManager(root);
        const report = createMigrationReport();

        const knownActions = ["all", "deps", "lint-staged", "turborepo", "nx", "moon"];

        if (!knownActions.includes(action)) {
            throw new Error(`Unknown migration type "${action}". Use one of: ${knownActions.join(", ")}.`);
        }

        if (dryRun) {
            logger.info("Running in dry-run mode — no changes will be made.\n");
        }

        if (action === "all" || action === "deps") {
            logger.info("── Migrating dependencies and scripts ──");
            migrateDeps(root, packageManager, config as Record<string, unknown> & { overrides?: Record<string, string> }, { dryRun }, logger, report);
            logger.info("");
        }

        if (action === "all" || action === "lint-staged") {
            logger.info("── Migrating lint-staged ──");
            migrateLintStaged(root, { dryRun }, logger, report);
            logger.info("");
        }

        if (action === "turborepo") {
            logger.info("── Migrating turborepo ──");
            migrateTurborepo(root, { dryRun }, logger, report);
            logger.info("");
        }

        if (action === "nx") {
            logger.info("── Migrating nx ──");
            migrateNx(root, { dryRun }, logger, report);
            logger.info("");
        }

        if (action === "moon") {
            logger.info("── Migrating moon ──");
            migrateMoon(root, { dryRun }, logger, report);
            logger.info("");
        }

        printSummary(report, logger);
    },
    name: "migrate",
    options: [
        {
            defaultValue: false,
            description: "Preview changes without applying",
            name: "dry-run",
            type: Boolean,
        },
    ],
};

export default migrate;
