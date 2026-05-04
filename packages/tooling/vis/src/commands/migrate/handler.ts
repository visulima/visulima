import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { detectPackageManager } from "../hook/migrate";
import { migrateDeps } from "./deps";
import { migrateGitleaks } from "./gitleaks";
import type {
    MigrateDepsOptions,
    MigrateGitleaksOptions,
    MigrateKingfisherOptions,
    MigrateLintStagedOptions,
    MigrateMoonOptions,
    MigrateNanoStagedOptions,
    MigrateNxOptions,
    MigrateSecretlintOptions,
    MigrateTurborepoOptions,
} from "./index";
import { migrateKingfisher } from "./kingfisher";
import { migrateLintStaged } from "./lint-staged";
import { migrateMoon } from "./moon";
import { migrateNanoStaged } from "./nano-staged";
import { migrateNx } from "./nx";
import { confirm } from "./prompt";
import { migrateSecretlint } from "./secretlint";
import { printSummary } from "./summary";
import { migrateTurborepo } from "./turborepo";
import type { MigrationReport } from "./types";
import { createMigrationReport } from "./types";
import { verifyMigration } from "./verify";

interface Logger {
    info: (message: string) => void;
    warn: (message: string) => void;
}

interface MigrationContext {
    config: Record<string, unknown>;
    dryRun: boolean;
    logger: Logger;
    packageManager: ReturnType<typeof detectPackageManager>;
    report: MigrationReport;
    root: string;
}

const buildContext = (toolbox: {
    logger: Logger;
    options: Record<string, unknown>;
    visConfig?: Record<string, unknown>;
    workspaceRoot?: string;
}): MigrationContext => {
    const root = toolbox.workspaceRoot ?? process.cwd();

    return {
        config: toolbox.visConfig ?? {},
        dryRun: Boolean(toolbox.options.dryRun),
        logger: toolbox.logger,
        packageManager: detectPackageManager(root),
        report: createMigrationReport(),
        root,
    };
};

/**
 * Prompt for confirmation before running an individual (non-`all`) migration.
 * Skipped when `--yes` is passed or when running in dry-run mode.
 */
const maybeConfirm = async (name: string, options: Record<string, unknown>, logger: Logger): Promise<boolean> => {
    if (options.yes || options.dryRun) {
        return true;
    }

    const confirmed = await confirm(`This will edit files, scripts, and hooks for "${name}". Backups (.bak) will be created. Continue?`);

    if (!confirmed) {
        logger.info("Aborted.");
    }

    return confirmed;
};

const announceDryRun = (ctx: MigrationContext): void => {
    if (ctx.dryRun) {
        ctx.logger.info("Running in dry-run mode — no changes will be made.\n");
    }
};

const migrateDepsExecuteImpl = async ({ logger, options, visConfig, workspaceRoot }: Toolbox<Console, MigrateDepsOptions>): Promise<void> => {
    if (!(await maybeConfirm("deps", options, logger))) {
        return;
    }

    const ctx = buildContext({ logger, options, visConfig: visConfig as Record<string, unknown> | undefined, workspaceRoot });

    announceDryRun(ctx);

    logger.info("── Migrating dependencies and scripts ──");
    migrateDeps(
        ctx.root,
        ctx.packageManager,
        ctx.config,
        { dryRun: ctx.dryRun },
        logger,
        ctx.report,
    );
    logger.info("");

    printSummary(ctx.report, logger);
};

const migrateLintStagedExecuteImpl = async ({ logger, options, visConfig, workspaceRoot }: Toolbox<Console, MigrateLintStagedOptions>): Promise<void> => {
    if (!(await maybeConfirm("lint-staged", options, logger))) {
        return;
    }

    const ctx = buildContext({ logger, options, visConfig: visConfig as Record<string, unknown> | undefined, workspaceRoot });

    announceDryRun(ctx);

    logger.info("── Migrating lint-staged ──");
    migrateLintStaged(ctx.root, { dryRun: ctx.dryRun }, logger, ctx.report);
    logger.info("");

    printSummary(ctx.report, logger);
};

const migrateNanoStagedExecuteImpl = async ({ logger, options, visConfig, workspaceRoot }: Toolbox<Console, MigrateNanoStagedOptions>): Promise<void> => {
    if (!(await maybeConfirm("nano-staged", options, logger))) {
        return;
    }

    const ctx = buildContext({ logger, options, visConfig: visConfig as Record<string, unknown> | undefined, workspaceRoot });

    announceDryRun(ctx);

    logger.info("── Migrating nano-staged ──");
    migrateNanoStaged(ctx.root, { dryRun: ctx.dryRun }, logger, ctx.report);
    logger.info("");

    printSummary(ctx.report, logger);
};

const migrateTurborepoExecuteImpl = async ({ logger, options, visConfig, workspaceRoot }: Toolbox<Console, MigrateTurborepoOptions>): Promise<void> => {
    if (!(await maybeConfirm("turborepo", options, logger))) {
        return;
    }

    const ctx = buildContext({ logger, options, visConfig: visConfig as Record<string, unknown> | undefined, workspaceRoot });

    announceDryRun(ctx);

    logger.info("── Migrating turborepo ──");
    migrateTurborepo(ctx.root, { dryRun: ctx.dryRun }, logger, ctx.report);
    logger.info("");

    printSummary(ctx.report, logger);
};

const migrateNxExecuteImpl = async ({ logger, options, visConfig, workspaceRoot }: Toolbox<Console, MigrateNxOptions>): Promise<void> => {
    if (!(await maybeConfirm("nx", options, logger))) {
        return;
    }

    const ctx = buildContext({ logger, options, visConfig: visConfig as Record<string, unknown> | undefined, workspaceRoot });

    announceDryRun(ctx);

    logger.info("── Migrating nx ──");
    migrateNx(ctx.root, { dryRun: ctx.dryRun }, logger, ctx.report);
    logger.info("");

    printSummary(ctx.report, logger);
};

const migrateMoonExecuteImpl = async ({ logger, options, visConfig, workspaceRoot }: Toolbox<Console, MigrateMoonOptions>): Promise<void> => {
    if (!(await maybeConfirm("moon", options, logger))) {
        return;
    }

    const ctx = buildContext({ logger, options, visConfig: visConfig as Record<string, unknown> | undefined, workspaceRoot });

    announceDryRun(ctx);

    logger.info("── Migrating moon ──");
    migrateMoon(ctx.root, { copyTemplates: Boolean(options.copyTemplates), dryRun: ctx.dryRun }, logger, ctx.report);
    logger.info("");

    printSummary(ctx.report, logger);
};

const migrateGitleaksExecuteImpl = async ({ logger, options, visConfig, workspaceRoot }: Toolbox<Console, MigrateGitleaksOptions>): Promise<void> => {
    if (!(await maybeConfirm("gitleaks", options, logger))) {
        return;
    }

    const ctx = buildContext({ logger, options, visConfig: visConfig as Record<string, unknown> | undefined, workspaceRoot });

    announceDryRun(ctx);

    logger.info("── Migrating gitleaks ──");
    migrateGitleaks(ctx.root, { dryRun: ctx.dryRun }, logger, ctx.report);
    logger.info("");

    printSummary(ctx.report, logger);
};

const migrateKingfisherExecuteImpl = async ({ logger, options, visConfig, workspaceRoot }: Toolbox<Console, MigrateKingfisherOptions>): Promise<void> => {
    if (!(await maybeConfirm("kingfisher", options, logger))) {
        return;
    }

    const ctx = buildContext({ logger, options, visConfig: visConfig as Record<string, unknown> | undefined, workspaceRoot });

    announceDryRun(ctx);

    logger.info("── Migrating Kingfisher ──");
    migrateKingfisher(ctx.root, { dryRun: ctx.dryRun }, logger, ctx.report);
    logger.info("");

    printSummary(ctx.report, logger);
};

const migrateSecretlintExecuteImpl = async ({ logger, options, visConfig, workspaceRoot }: Toolbox<Console, MigrateSecretlintOptions>): Promise<void> => {
    if (!(await maybeConfirm("secretlint", options, logger))) {
        return;
    }

    const ctx = buildContext({ logger, options, visConfig: visConfig as Record<string, unknown> | undefined, workspaceRoot });

    announceDryRun(ctx);

    logger.info("── Migrating secretlint ──");
    migrateSecretlint(ctx.root, { dryRun: ctx.dryRun }, logger, ctx.report);
    logger.info("");

    printSummary(ctx.report, logger);
};

const migrateVerifyExecuteImpl = ({ logger, workspaceRoot }: Toolbox): void => {
    const root = workspaceRoot ?? process.cwd();
    const issues = verifyMigration(root, logger);

    if (issues.length > 0) {
        process.exitCode = 1;
    }
};

export const migrateDepsExecute = migrateDepsExecuteImpl as CommandExecute<Toolbox>;
export const migrateLintStagedExecute = migrateLintStagedExecuteImpl as CommandExecute<Toolbox>;
export const migrateNanoStagedExecute = migrateNanoStagedExecuteImpl as CommandExecute<Toolbox>;
export const migrateTurborepoExecute = migrateTurborepoExecuteImpl as CommandExecute<Toolbox>;
export const migrateNxExecute = migrateNxExecuteImpl as CommandExecute<Toolbox>;
export const migrateMoonExecute = migrateMoonExecuteImpl as CommandExecute<Toolbox>;
export const migrateGitleaksExecute = migrateGitleaksExecuteImpl as CommandExecute<Toolbox>;
export const migrateKingfisherExecute = migrateKingfisherExecuteImpl as CommandExecute<Toolbox>;
export const migrateSecretlintExecute = migrateSecretlintExecuteImpl as CommandExecute<Toolbox>;
export const migrateVerifyExecute = migrateVerifyExecuteImpl;
