import type { Command } from "@visulima/cerebro";

import { detectPackageManager } from "../hook/migrate";
import { migrateDeps } from "./deps";
import { migrateGitleaks } from "./gitleaks";
import { migrateKingfisher } from "./kingfisher";
import { migrateLintStaged } from "./lint-staged";
import { migrateMoon } from "./moon";
import { migrateNanoStaged } from "./nano-staged";
import { migrateNx } from "./nx";
import { confirm } from "./prompt";
import { migrateSecretlint } from "./secretlint";
import { migrateTurborepo } from "./turborepo";
import type { MigrationReport } from "./types";
import { createMigrationReport } from "./types";
import { verifyMigration } from "./verify";

interface Logger {
    info: (message: string) => void;
    warn: (message: string) => void;
}

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

    const perMigrationEntries = Object.entries(report.perMigration);

    if (perMigrationEntries.length > 0) {
        logger.info("");
        logger.info("By migration:");

        for (const [name, bucket] of perMigrationEntries) {
            const parts: string[] = [];

            if (bucket.removedConfigCount > 0) {
                parts.push(`${String(bucket.removedConfigCount)} config(s) removed`);
            }

            if (bucket.removedPackageCount > 0) {
                parts.push(`${String(bucket.removedPackageCount)} package(s) removed`);
            }

            if (bucket.rewrittenScriptCount > 0) {
                parts.push(`${String(bucket.rewrittenScriptCount)} script(s) rewritten`);
            }

            logger.info(`  ${name}: ${parts.join(", ") || "no changes"}`);
        }
    }

    if (report.backupsCreated.length > 0) {
        logger.info("");
        logger.info(`Created ${String(report.backupsCreated.length)} .bak file(s) for rollback. Remove them once you're happy.`);
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
    argument: {
        description: "Migration type: all, deps, lint-staged, nano-staged, turborepo, nx, moon, gitleaks, kingfisher, secretlint, verify",
        name: "type",
        type: String,
    },
    description: "Migrate from other tools to vis (or verify a prior migration with `verify`)",
    examples: [
        ["vis migrate", "Run all built-in migrations"],
        ["vis migrate gitleaks", "Migrate gitleaks config/baseline/hooks to `vis secrets`"],
        ["vis migrate kingfisher", "Migrate Kingfisher baseline/hooks/scripts to `vis secrets`"],
        ["vis migrate secretlint", "Replace secretlint with `vis secrets`"],
        ["vis migrate verify", "Audit the workspace for stray gitleaks/secretlint references (exit 1 on issues)"],
    ],
    execute: async ({ argument, logger, options, visConfig, workspaceRoot }) => {
        const action = (argument[0] as string | undefined) ?? "all";
        const dryRun = Boolean(options.dryRun);
        const yes = Boolean(options.yes);
        const root = workspaceRoot ?? process.cwd();
        const config = (visConfig ?? {}) as Record<string, unknown>;
        const packageManager = detectPackageManager(root);
        const report = createMigrationReport();

        const knownActions = ["all", "deps", "lint-staged", "nano-staged", "turborepo", "nx", "moon", "gitleaks", "kingfisher", "secretlint", "verify"];

        if (!knownActions.includes(action)) {
            throw new Error(`Unknown migration type "${action}". Use one of: ${knownActions.join(", ")}.`);
        }

        if (action === "verify") {
            const issues = verifyMigration(root, logger);

            if (issues.length > 0) {
                process.exitCode = 1;
            }

            return;
        }

        if (dryRun) {
            logger.info("Running in dry-run mode — no changes will be made.\n");
        } else if (!yes && action !== "all") {
            const confirmed = await confirm(`This will edit files, scripts, and hooks for "${action}". Backups (.bak) will be created. Continue?`);

            if (!confirmed) {
                logger.info("Aborted.");

                return;
            }
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

        if (action === "all" || action === "nano-staged") {
            logger.info("── Migrating nano-staged ──");
            migrateNanoStaged(root, { dryRun }, logger, report);
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
            migrateMoon(root, { copyTemplates: Boolean(options.copyTemplates), dryRun }, logger, report);
            logger.info("");
        }

        if (action === "gitleaks") {
            logger.info("── Migrating gitleaks ──");
            migrateGitleaks(root, { dryRun }, logger, report);
            logger.info("");
        }

        if (action === "kingfisher") {
            logger.info("── Migrating Kingfisher ──");
            migrateKingfisher(root, { dryRun }, logger, report);
            logger.info("");
        }

        if (action === "secretlint") {
            logger.info("── Migrating secretlint ──");
            migrateSecretlint(root, { dryRun }, logger, report);
            logger.info("");
        }

        printSummary(report, logger);
    },
    group: "Scaffold & Config",
    name: "migrate",
    options: [
        { defaultValue: false, description: "Preview changes without applying", name: "dry-run", type: Boolean },
        { alias: "y", defaultValue: false, description: "Skip the confirmation prompt", name: "yes", type: Boolean },
        {
            defaultValue: false,
            description: "For `vis migrate moon`: copy .moon/templates/* into .vis/templates/* so vis generate works without .moon/",
            name: "copy-templates",
            type: Boolean,
        },
    ],
};

export default migrate;
