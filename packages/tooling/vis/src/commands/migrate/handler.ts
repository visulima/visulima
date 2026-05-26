import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { detectPackageManager } from "../hook/migrate";
import { migrateDeps } from "./deps";
import type { OutputFormat, SourceTool } from "./equivalence";
import { buildSourceModel, buildVisModel, detectSourceTool, diffModels, equivalenceExitCode, formatEquivalenceReport, VALID_FORMATS } from "./equivalence";
import { migrateGitleaks } from "./gitleaks";
import type {
    MigrateAllOptions,
    MigrateDepsOptions,
    MigrateGitleaksOptions,
    MigrateKingfisherOptions,
    MigrateLintStagedOptions,
    MigrateMoonOptions,
    MigrateNanoStagedOptions,
    MigrateNxOptions,
    MigrateSecretlintOptions,
    MigrateSelfOptions,
    MigrateSherifOptions,
    MigrateSyncpackOptions,
    MigrateTurborepoOptions,
    MigrateVerifyGraphOptions,
} from "./index";
import { migrateKingfisher } from "./kingfisher";
import { migrateLintStaged } from "./lint-staged";
import { migrateMoon } from "./moon";
import { migrateNanoStaged } from "./nano-staged";
import { migrateNx } from "./nx";
import { confirm } from "./prompt";
import { buildProbeContext, getApplicableMigrations } from "./registry";
import { migrateSecretlint } from "./secretlint";
import { migrateSelf } from "./self";
import { migrateSherif } from "./sherif";
import { printSummary } from "./summary";
import { migrateSyncpack } from "./syncpack";
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
    useEditorconfig: boolean;
}

const buildContext = (toolbox: {
    logger: Logger;
    options: Record<string, unknown>;
    visConfig?: Record<string, unknown>;
    workspaceRoot?: string;
}): MigrationContext => {
    const root = toolbox.workspaceRoot ?? process.cwd();
    const config = toolbox.visConfig ?? {};

    return {
        config,
        dryRun: Boolean(toolbox.options.dryRun),
        logger: toolbox.logger,
        packageManager: detectPackageManager(root),
        report: createMigrationReport(),
        root,
        useEditorconfig: typeof config.editorconfig === "boolean" ? config.editorconfig : true,
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
    migrateDeps(ctx.root, ctx.packageManager, ctx.config, { dryRun: ctx.dryRun }, logger, ctx.report);
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
    migrateLintStaged(ctx.root, { dryRun: ctx.dryRun, useEditorconfig: ctx.useEditorconfig }, logger, ctx.report);
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
    migrateNanoStaged(ctx.root, { dryRun: ctx.dryRun, useEditorconfig: ctx.useEditorconfig }, logger, ctx.report);
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
    migrateTurborepo(ctx.root, { dryRun: ctx.dryRun, useEditorconfig: ctx.useEditorconfig }, logger, ctx.report);
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
    const aggressive = Boolean(options.aggressive);

    migrateNx(
        ctx.root,
        {
            aggressive,
            dryRun: ctx.dryRun,
            // --aggressive implies --force.
            force: aggressive || Boolean(options.force),
            // --aggressive implies --rewrite-sync-generators.
            rewriteSyncGenerators: aggressive || Boolean(options.rewriteSyncGenerators),
            useEditorconfig: ctx.useEditorconfig,
        },
        logger,
        ctx.report,
    );
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
    migrateMoon(ctx.root, { copyTemplates: Boolean(options.copyTemplates), dryRun: ctx.dryRun, useEditorconfig: ctx.useEditorconfig }, logger, ctx.report);
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
    migrateGitleaks(ctx.root, { dryRun: ctx.dryRun, useEditorconfig: ctx.useEditorconfig }, logger, ctx.report);
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
    migrateKingfisher(ctx.root, { dryRun: ctx.dryRun, useEditorconfig: ctx.useEditorconfig }, logger, ctx.report);
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
    migrateSecretlint(ctx.root, { dryRun: ctx.dryRun, useEditorconfig: ctx.useEditorconfig }, logger, ctx.report);
    logger.info("");

    printSummary(ctx.report, logger);
};

const migrateSyncpackExecuteImpl = async ({ logger, options, visConfig, workspaceRoot }: Toolbox<Console, MigrateSyncpackOptions>): Promise<void> => {
    if (!(await maybeConfirm("syncpack", options, logger))) {
        return;
    }

    const ctx = buildContext({ logger, options, visConfig: visConfig as Record<string, unknown> | undefined, workspaceRoot });

    announceDryRun(ctx);

    logger.info("── Migrating syncpack ──");
    migrateSyncpack(ctx.root, { dryRun: ctx.dryRun, useEditorconfig: ctx.useEditorconfig }, logger, ctx.report);
    logger.info("");

    printSummary(ctx.report, logger);
};

const migrateSherifExecuteImpl = async ({ logger, options, visConfig, workspaceRoot }: Toolbox<Console, MigrateSherifOptions>): Promise<void> => {
    if (!(await maybeConfirm("sherif", options, logger))) {
        return;
    }

    const ctx = buildContext({ logger, options, visConfig: visConfig as Record<string, unknown> | undefined, workspaceRoot });

    announceDryRun(ctx);

    logger.info("── Migrating sherif ──");
    migrateSherif(ctx.root, { dryRun: ctx.dryRun, useEditorconfig: ctx.useEditorconfig }, logger, ctx.report);
    logger.info("");

    printSummary(ctx.report, logger);
};

const migrateSelfExecuteImpl = async ({ logger, options, visConfig, workspaceRoot }: Toolbox<Console, MigrateSelfOptions>): Promise<void> => {
    if (!(await maybeConfirm("self", options, logger))) {
        return;
    }

    const ctx = buildContext({ logger, options, visConfig: visConfig as Record<string, unknown> | undefined, workspaceRoot });

    announceDryRun(ctx);

    logger.info("── Migrating vis.config.ts to current schema ──");
    migrateSelf(ctx.root, { dryRun: ctx.dryRun }, logger, ctx.report);
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

const migrateVerifyGraphExecuteImpl = async ({ logger, options, workspaceRoot }: Toolbox<Console, MigrateVerifyGraphOptions>): Promise<void> => {
    const root = workspaceRoot ?? process.cwd();

    const format = (options.format ?? "table") as OutputFormat;

    if (!VALID_FORMATS.has(format)) {
        logger.warn(`Invalid --format: ${String(options.format)}. Expected table | json | ndjson.`);
        process.exitCode = 1;

        return;
    }

    const failOn = options.failOn === "warning" ? "warning" : "error";

    let tool: SourceTool | undefined;

    if (options.from) {
        if (options.from !== "turbo" && options.from !== "nx" && options.from !== "moon") {
            logger.warn(`Invalid --from: ${options.from}. Expected turbo | nx | moon.`);
            process.exitCode = 1;

            return;
        }

        tool = options.from;
    } else {
        tool = detectSourceTool(root);

        if (!tool) {
            logger.warn("Could not auto-detect the source tool (need exactly one of turbo.json / nx.json / .moon/tasks.yml). Pass --from <turbo|nx|moon>.");
            process.exitCode = 1;

            return;
        }
    }

    const sourceModel = buildSourceModel(root, tool);

    if (sourceModel.size === 0) {
        logger.warn(`No ${tool} task graph found at ${root} — nothing to verify.`);
        process.exitCode = 1;

        return;
    }

    const visModel = await buildVisModel(root);

    if (visModel.size === 0) {
        logger.warn("No migrated vis task graph found (vis.config.ts has no tasks). Run the migrator first.");
        process.exitCode = 1;

        return;
    }

    const report = diffModels(sourceModel, visModel, tool);

    formatEquivalenceReport(report, format, logger);

    process.exitCode = equivalenceExitCode(report, failOn);
};

const migrateAllExecuteImpl = async ({ logger, options, visConfig, workspaceRoot }: Toolbox<Console, MigrateAllOptions>): Promise<void> => {
    const root = workspaceRoot ?? process.cwd();
    const config = visConfig ?? {};
    const context = buildProbeContext(root, config);
    const applicable = getApplicableMigrations(context);

    if (applicable.length === 0) {
        logger.info("No applicable migrations detected in this workspace.");

        return;
    }

    const dryRun = Boolean(options.dryRun);

    logger.info(`Detected ${String(applicable.length)} migration(s):`);

    for (const entry of applicable) {
        logger.info(`  • ${entry.title} — ${entry.description}`);
    }

    logger.info("");

    if (!options.yes && !dryRun) {
        const confirmed = await confirm("Apply all detected migrations? Backups (.bak) will be created.");

        if (!confirmed) {
            logger.info("Aborted.");

            return;
        }
    }

    if (dryRun) {
        logger.info("Running in dry-run mode — no changes will be made.\n");
    }

    const report: MigrationReport = createMigrationReport();
    const failures: { error: unknown; id: string }[] = [];

    for (const entry of applicable) {
        try {
            logger.info(`── Applying ${entry.title} ──`);

            if (dryRun) {
                for (const line of entry.probe(context)) {
                    logger.info(line);
                }
            } else {
                entry.apply(context, report, logger);
            }

            logger.info("");
        } catch (error) {
            failures.push({ error, id: entry.id });
            logger.warn(`Failed to apply ${entry.title}: ${(error as Error).message}`);
        }
    }

    printSummary(report, logger);

    if (failures.length > 0) {
        logger.warn("");
        logger.warn(`${String(failures.length)} migration(s) failed — see messages above.`);
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
export const migrateSyncpackExecute = migrateSyncpackExecuteImpl as CommandExecute<Toolbox>;
export const migrateSherifExecute = migrateSherifExecuteImpl as CommandExecute<Toolbox>;
export const migrateSelfExecute = migrateSelfExecuteImpl as CommandExecute<Toolbox>;
export const migrateVerifyExecute = migrateVerifyExecuteImpl;
export const migrateVerifyGraphExecute = migrateVerifyGraphExecuteImpl as CommandExecute<Toolbox>;
export const migrateAllExecute = migrateAllExecuteImpl as CommandExecute<Toolbox>;
