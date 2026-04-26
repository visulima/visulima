import type { MigrateLogger, MigrationReport } from "./types";

export const printSummary = (report: MigrationReport, logger: MigrateLogger): void => {
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
