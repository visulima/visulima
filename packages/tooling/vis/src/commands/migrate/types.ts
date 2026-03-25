interface MigrateLogger {
    info: (message: string) => void;
    warn: (message: string) => void;
}

interface MigrationReport {
    gitHooksConfigured: boolean;
    inlinedLintStagedConfigCount: number;
    manualSteps: string[];
    mergedStagedConfigCount: number;
    removedConfigCount: number;
    removedPackageCount: number;
    rewrittenScriptCount: number;
    warnings: string[];
}

const createMigrationReport = (): MigrationReport => {
    return {
        gitHooksConfigured: false,
        inlinedLintStagedConfigCount: 0,
        manualSteps: [],
        mergedStagedConfigCount: 0,
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

type PackageManagerType = "bun" | "npm" | "pnpm" | "yarn";

export type { MigrateLogger, MigrationReport, PackageManagerType };
export { addManualStep, addMigrationWarning, createMigrationReport };
