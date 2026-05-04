import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import type { VisConfig } from "../../config/workspace";
import { detectPackageManager } from "../hook/migrate";
import { REPLACED_PACKAGES } from "./constants";
import { migrateDeps } from "./deps";
import { detectGitleaksBaseline, detectGitleaksConfig, detectGitleaksIgnore, migrateGitleaks } from "./gitleaks";
import { detectKingfisherBaseline, detectKingfisherRules, migrateKingfisher } from "./kingfisher";
import { detectLintStagedConfig, migrateLintStaged } from "./lint-staged";
import { migrateMoon } from "./moon";
import { detectNanoStagedConfig, migrateNanoStaged } from "./nano-staged";
import { migrateNx } from "./nx";
import { detectSecretlintConfig, detectSecretlintIgnore, migrateSecretlint } from "./secretlint";
import { migrateTurborepo } from "./turborepo";
import type { MigrateLogger, MigrationReport, PackageManagerType } from "./types";
import { createMigrationReport } from "./types";

const HUSKY_OR_LINT_STAGED_SCRIPT_RE = /\b(?:husky|lint-staged|nano-staged)\b/;

interface PackageJsonShape {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
}

const readPackageJson = (root: string): PackageJsonShape | undefined => {
    const path = join(root, "package.json");

    if (!isAccessibleSync(path)) {
        return undefined;
    }

    try {
        return JSON.parse(readFileSync(path)) as PackageJsonShape;
    } catch {
        return undefined;
    }
};

const detectDepsNeedsMigration = (root: string, visConfig: VisConfig): boolean => {
    const pkg = readPackageJson(root);

    if (!pkg) {
        return false;
    }

    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    for (const name of REPLACED_PACKAGES) {
        if (allDeps[name]) {
            return true;
        }
    }

    if (pkg.scripts) {
        for (const value of Object.values(pkg.scripts)) {
            if (typeof value === "string" && HUSKY_OR_LINT_STAGED_SCRIPT_RE.test(value)) {
                return true;
            }
        }
    }

    const { overrides } = visConfig;

    return overrides ? Object.keys(overrides).length > 0 : false;
};

const detectTurborepo = (root: string): boolean => isAccessibleSync(join(root, "turbo.json"));
const detectNx = (root: string): boolean => isAccessibleSync(join(root, "nx.json"));
const detectMoon = (root: string): boolean => isAccessibleSync(join(root, ".moon"));

export interface ProbeContext {
    packageManager: PackageManagerType;
    root: string;
    visConfig: VisConfig;
}

export interface MigrationEntry {
    /** Runs the migration for real and mutates the shared report. */
    apply: (context: ProbeContext, report: MigrationReport, logger: MigrateLogger) => void;
    /** One-line description of what will be migrated. */
    description: string;
    /** Cheap filesystem check — decides whether to include the migration in the TUI. */
    detect: (context: ProbeContext) => boolean;
    /** Stable identifier (also matches the nested cerebro subcommand name). */
    id: string;
    /** Runs the migration in dry-run and returns the captured preview lines. */
    probe: (context: ProbeContext) => string[];
    /** Title displayed in the list. */
    title: string;
}

const createCapturingLogger = (): { lines: string[]; logger: MigrateLogger } => {
    const lines: string[] = [];

    return {
        lines,
        logger: {
            info: (message: string) => {
                lines.push(message);
            },
            warn: (message: string) => {
                lines.push(`⚠  ${message}`);
            },
        },
    };
};

const MIGRATIONS: MigrationEntry[] = [
    {
        apply: ({ packageManager, root, visConfig }, report, logger) => {
            migrateDeps(root, packageManager, visConfig, { dryRun: false }, logger, report);
        },
        description: "Remove husky/lint-staged/nano-staged from package.json and rewrite scripts to `vis staged`.",
        detect: ({ root, visConfig }) => detectDepsNeedsMigration(root, visConfig),
        id: "deps",
        probe: ({ packageManager, root, visConfig }) => {
            const { lines, logger } = createCapturingLogger();
            const report = createMigrationReport();

            migrateDeps(root, packageManager, visConfig, { dryRun: true }, logger, report);

            return lines;
        },
        title: "Dependencies & scripts",
    },
    {
        apply: ({ root }, report, logger) => {
            migrateLintStaged(root, { dryRun: false }, logger, report);
        },
        description: "Inline lint-staged configuration into vis.config.ts.",
        detect: ({ root }) => Boolean(detectLintStagedConfig(root)),
        id: "lint-staged",
        probe: ({ root }) => {
            const { lines, logger } = createCapturingLogger();
            const report = createMigrationReport();

            migrateLintStaged(root, { dryRun: true }, logger, report);

            return lines;
        },
        title: "lint-staged",
    },
    {
        apply: ({ root }, report, logger) => {
            migrateNanoStaged(root, { dryRun: false }, logger, report);
        },
        description: "Inline nano-staged configuration into vis.config.ts.",
        detect: ({ root }) => Boolean(detectNanoStagedConfig(root)),
        id: "nano-staged",
        probe: ({ root }) => {
            const { lines, logger } = createCapturingLogger();
            const report = createMigrationReport();

            migrateNanoStaged(root, { dryRun: true }, logger, report);

            return lines;
        },
        title: "nano-staged",
    },
    {
        apply: ({ root }, report, logger) => {
            migrateTurborepo(root, { dryRun: false }, logger, report);
        },
        description: "Translate turbo.json tasks into vis.config.ts.",
        detect: ({ root }) => detectTurborepo(root),
        id: "turborepo",
        probe: ({ root }) => {
            const { lines, logger } = createCapturingLogger();
            const report = createMigrationReport();

            migrateTurborepo(root, { dryRun: true }, logger, report);

            return lines;
        },
        title: "Turborepo",
    },
    {
        apply: ({ root }, report, logger) => {
            migrateNx(root, { dryRun: false }, logger, report);
        },
        description: "Translate nx.json targets into vis.config.ts.",
        detect: ({ root }) => detectNx(root),
        id: "nx",
        probe: ({ root }) => {
            const { lines, logger } = createCapturingLogger();
            const report = createMigrationReport();

            migrateNx(root, { dryRun: true }, logger, report);

            return lines;
        },
        title: "Nx",
    },
    {
        apply: ({ root }, report, logger) => {
            migrateMoon(root, { copyTemplates: false, dryRun: false }, logger, report);
        },
        description: "Translate .moon/tasks.yml into vis.config.ts.",
        detect: ({ root }) => detectMoon(root),
        id: "moon",
        probe: ({ root }) => {
            const { lines, logger } = createCapturingLogger();
            const report = createMigrationReport();

            migrateMoon(root, { copyTemplates: false, dryRun: true }, logger, report);

            return lines;
        },
        title: "Moon",
    },
    {
        apply: ({ root }, report, logger) => {
            migrateGitleaks(root, { dryRun: false }, logger, report);
        },
        description: "Convert gitleaks config/baseline/hooks to `vis secrets`.",
        detect: ({ root }) => Boolean(detectGitleaksConfig(root) ?? detectGitleaksIgnore(root) ?? detectGitleaksBaseline(root)),
        id: "gitleaks",
        probe: ({ root }) => {
            const { lines, logger } = createCapturingLogger();
            const report = createMigrationReport();

            migrateGitleaks(root, { dryRun: true }, logger, report);

            return lines;
        },
        title: "Gitleaks",
    },
    {
        apply: ({ root }, report, logger) => {
            migrateKingfisher(root, { dryRun: false }, logger, report);
        },
        description: "Convert Kingfisher baseline/rules/hooks to `vis secrets`.",
        detect: ({ root }) => Boolean(detectKingfisherBaseline(root) ?? detectKingfisherRules(root)),
        id: "kingfisher",
        probe: ({ root }) => {
            const { lines, logger } = createCapturingLogger();
            const report = createMigrationReport();

            migrateKingfisher(root, { dryRun: true }, logger, report);

            return lines;
        },
        title: "Kingfisher",
    },
    {
        apply: ({ root }, report, logger) => {
            migrateSecretlint(root, { dryRun: false }, logger, report);
        },
        description: "Replace secretlint config/hooks with `vis secrets`.",
        detect: ({ root }) => Boolean(detectSecretlintConfig(root) ?? detectSecretlintIgnore(root)),
        id: "secretlint",
        probe: ({ root }) => {
            const { lines, logger } = createCapturingLogger();
            const report = createMigrationReport();

            migrateSecretlint(root, { dryRun: true }, logger, report);

            return lines;
        },
        title: "Secretlint",
    },
];

export const getApplicableMigrations = (context: ProbeContext): MigrationEntry[] => MIGRATIONS.filter((entry) => entry.detect(context));

export const buildProbeContext = (root: string, visConfig: VisConfig): ProbeContext => {
    return {
        packageManager: detectPackageManager(root),
        root,
        visConfig,
    };
};

export { MIGRATIONS };
