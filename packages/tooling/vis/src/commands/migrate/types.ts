interface MigrateLogger {
    info: (message: string) => void;
    warn: (message: string) => void;
}

interface MigrationReport {
    backupsCreated: string[];
    gitHooksConfigured: boolean;
    inlinedLintStagedConfigCount: number;
    manualSteps: string[];
    mergedStagedConfigCount: number;
    perMigration: Record<string, { removedConfigCount: number; removedPackageCount: number; rewrittenScriptCount: number }>;
    removedConfigCount: number;
    removedPackageCount: number;
    rewrittenScriptCount: number;
    warnings: string[];
}

const createMigrationReport = (): MigrationReport => {
    return {
        backupsCreated: [],
        gitHooksConfigured: false,
        inlinedLintStagedConfigCount: 0,
        manualSteps: [],
        mergedStagedConfigCount: 0,
        perMigration: {},
        removedConfigCount: 0,
        removedPackageCount: 0,
        rewrittenScriptCount: 0,
        warnings: [],
    };
};

const addMigrationWarning = (report: MigrationReport | undefined, warning: string): void => {
    if (!report || report.warnings.includes(warning)) {
        return;
    }

    report.warnings.push(warning);
};

const addManualStep = (report: MigrationReport | undefined, step: string): void => {
    if (!report || report.manualSteps.includes(step)) {
        return;
    }

    report.manualSteps.push(step);
};

const bumpPerMigration = (
    report: MigrationReport,
    migration: string,
    field: "removedConfigCount" | "removedPackageCount" | "rewrittenScriptCount",
    delta = 1,
): void => {
    const bucket = report.perMigration[migration] ?? { removedConfigCount: 0, removedPackageCount: 0, rewrittenScriptCount: 0 };

    bucket[field] += delta;
    report.perMigration[migration] = bucket;
    report[field] += delta;
};

type PackageManagerType = "bun" | "npm" | "pnpm" | "yarn";

export type { MigrateLogger, MigrationReport, PackageManagerType };
export { addManualStep, addMigrationWarning, bumpPerMigration, createMigrationReport };
