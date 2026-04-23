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

const buildContext = (toolbox: { logger: Logger; options: Record<string, unknown>; visConfig?: Record<string, unknown>; workspaceRoot?: string }): MigrationContext => {
    const root = toolbox.workspaceRoot ?? process.cwd();

    return {
        config: (toolbox.visConfig ?? {}),
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

const sharedMigrateOptions = [
    { defaultValue: false, description: "Preview changes without applying", name: "dry-run", type: Boolean },
    { alias: "y", defaultValue: false, description: "Skip the confirmation prompt", name: "yes", type: Boolean },
] as const;

const migrateDepsCmd: Command = {
    commandPath: ["migrate"],
    description: "Migrate dependencies and scripts to vis",
    execute: async ({ logger, options, visConfig, workspaceRoot }) => {
        if (!(await maybeConfirm("deps", options, logger))) {
            return;
        }

        const ctx = buildContext({ logger, options, visConfig: visConfig as Record<string, unknown> | undefined, workspaceRoot });

        announceDryRun(ctx);

        logger.info("── Migrating dependencies and scripts ──");
        migrateDeps(
            ctx.root,
            ctx.packageManager,
            ctx.config as Record<string, unknown> & { overrides?: Record<string, string> },
            { dryRun: ctx.dryRun },
            logger,
            ctx.report,
        );
        logger.info("");

        printSummary(ctx.report, logger);
    },
    group: "Scaffold & Config",
    name: "deps",
    options: [...sharedMigrateOptions],
};

const migrateLintStagedCmd: Command = {
    commandPath: ["migrate"],
    description: "Inline lint-staged configuration into vis",
    execute: async ({ logger, options, visConfig, workspaceRoot }) => {
        if (!(await maybeConfirm("lint-staged", options, logger))) {
            return;
        }

        const ctx = buildContext({ logger, options, visConfig: visConfig as Record<string, unknown> | undefined, workspaceRoot });

        announceDryRun(ctx);

        logger.info("── Migrating lint-staged ──");
        migrateLintStaged(ctx.root, { dryRun: ctx.dryRun }, logger, ctx.report);
        logger.info("");

        printSummary(ctx.report, logger);
    },
    group: "Scaffold & Config",
    name: "lint-staged",
    options: [...sharedMigrateOptions],
};

const migrateNanoStagedCmd: Command = {
    commandPath: ["migrate"],
    description: "Inline nano-staged configuration into vis",
    execute: async ({ logger, options, visConfig, workspaceRoot }) => {
        if (!(await maybeConfirm("nano-staged", options, logger))) {
            return;
        }

        const ctx = buildContext({ logger, options, visConfig: visConfig as Record<string, unknown> | undefined, workspaceRoot });

        announceDryRun(ctx);

        logger.info("── Migrating nano-staged ──");
        migrateNanoStaged(ctx.root, { dryRun: ctx.dryRun }, logger, ctx.report);
        logger.info("");

        printSummary(ctx.report, logger);
    },
    group: "Scaffold & Config",
    name: "nano-staged",
    options: [...sharedMigrateOptions],
};

const migrateTurborepoCmd: Command = {
    commandPath: ["migrate"],
    description: "Migrate turborepo tasks/config to vis",
    execute: async ({ logger, options, visConfig, workspaceRoot }) => {
        if (!(await maybeConfirm("turborepo", options, logger))) {
            return;
        }

        const ctx = buildContext({ logger, options, visConfig: visConfig as Record<string, unknown> | undefined, workspaceRoot });

        announceDryRun(ctx);

        logger.info("── Migrating turborepo ──");
        migrateTurborepo(ctx.root, { dryRun: ctx.dryRun }, logger, ctx.report);
        logger.info("");

        printSummary(ctx.report, logger);
    },
    group: "Scaffold & Config",
    name: "turborepo",
    options: [...sharedMigrateOptions],
};

const migrateNxCmd: Command = {
    commandPath: ["migrate"],
    description: "Migrate nx targets/config to vis",
    execute: async ({ logger, options, visConfig, workspaceRoot }) => {
        if (!(await maybeConfirm("nx", options, logger))) {
            return;
        }

        const ctx = buildContext({ logger, options, visConfig: visConfig as Record<string, unknown> | undefined, workspaceRoot });

        announceDryRun(ctx);

        logger.info("── Migrating nx ──");
        migrateNx(ctx.root, { dryRun: ctx.dryRun }, logger, ctx.report);
        logger.info("");

        printSummary(ctx.report, logger);
    },
    group: "Scaffold & Config",
    name: "nx",
    options: [...sharedMigrateOptions],
};

const migrateMoonCmd: Command = {
    commandPath: ["migrate"],
    description: "Migrate moon tasks/templates to vis",
    execute: async ({ logger, options, visConfig, workspaceRoot }) => {
        if (!(await maybeConfirm("moon", options, logger))) {
            return;
        }

        const ctx = buildContext({ logger, options, visConfig: visConfig as Record<string, unknown> | undefined, workspaceRoot });

        announceDryRun(ctx);

        logger.info("── Migrating moon ──");
        migrateMoon(ctx.root, { copyTemplates: Boolean(options.copyTemplates), dryRun: ctx.dryRun }, logger, ctx.report);
        logger.info("");

        printSummary(ctx.report, logger);
    },
    group: "Scaffold & Config",
    name: "moon",
    options: [
        ...sharedMigrateOptions,
        {
            defaultValue: false,
            description: "Copy .moon/templates/* into .vis/templates/* so `vis generate` works without .moon/",
            name: "copy-templates",
            type: Boolean,
        },
    ],
};

const migrateGitleaksCmd: Command = {
    commandPath: ["migrate"],
    description: "Migrate gitleaks config/baseline/hooks to `vis secrets`",
    examples: [["vis migrate gitleaks", "Migrate gitleaks config/baseline/hooks to `vis secrets`"]],
    execute: async ({ logger, options, visConfig, workspaceRoot }) => {
        if (!(await maybeConfirm("gitleaks", options, logger))) {
            return;
        }

        const ctx = buildContext({ logger, options, visConfig: visConfig as Record<string, unknown> | undefined, workspaceRoot });

        announceDryRun(ctx);

        logger.info("── Migrating gitleaks ──");
        migrateGitleaks(ctx.root, { dryRun: ctx.dryRun }, logger, ctx.report);
        logger.info("");

        printSummary(ctx.report, logger);
    },
    group: "Scaffold & Config",
    name: "gitleaks",
    options: [...sharedMigrateOptions],
};

const migrateKingfisherCmd: Command = {
    commandPath: ["migrate"],
    description: "Migrate Kingfisher baseline/hooks/scripts to `vis secrets`",
    examples: [["vis migrate kingfisher", "Migrate Kingfisher baseline/hooks/scripts to `vis secrets`"]],
    execute: async ({ logger, options, visConfig, workspaceRoot }) => {
        if (!(await maybeConfirm("kingfisher", options, logger))) {
            return;
        }

        const ctx = buildContext({ logger, options, visConfig: visConfig as Record<string, unknown> | undefined, workspaceRoot });

        announceDryRun(ctx);

        logger.info("── Migrating Kingfisher ──");
        migrateKingfisher(ctx.root, { dryRun: ctx.dryRun }, logger, ctx.report);
        logger.info("");

        printSummary(ctx.report, logger);
    },
    group: "Scaffold & Config",
    name: "kingfisher",
    options: [...sharedMigrateOptions],
};

const migrateSecretlintCmd: Command = {
    commandPath: ["migrate"],
    description: "Replace secretlint with `vis secrets`",
    examples: [["vis migrate secretlint", "Replace secretlint with `vis secrets`"]],
    execute: async ({ logger, options, visConfig, workspaceRoot }) => {
        if (!(await maybeConfirm("secretlint", options, logger))) {
            return;
        }

        const ctx = buildContext({ logger, options, visConfig: visConfig as Record<string, unknown> | undefined, workspaceRoot });

        announceDryRun(ctx);

        logger.info("── Migrating secretlint ──");
        migrateSecretlint(ctx.root, { dryRun: ctx.dryRun }, logger, ctx.report);
        logger.info("");

        printSummary(ctx.report, logger);
    },
    group: "Scaffold & Config",
    name: "secretlint",
    options: [...sharedMigrateOptions],
};

const migrateVerify: Command = {
    commandPath: ["migrate"],
    description: "Audit the workspace for stray gitleaks/secretlint references (exit 1 on issues)",
    examples: [["vis migrate verify", "Audit the workspace for stray gitleaks/secretlint references (exit 1 on issues)"]],
    execute: ({ logger, workspaceRoot }) => {
        const root = workspaceRoot ?? process.cwd();
        const issues = verifyMigration(root, logger);

        if (issues.length > 0) {
            process.exitCode = 1;
        }
    },
    group: "Scaffold & Config",
    name: "verify",
    options: [],
};

const migrateCommands: Command[] = [
    migrateDepsCmd,
    migrateLintStagedCmd,
    migrateNanoStagedCmd,
    migrateTurborepoCmd,
    migrateNxCmd,
    migrateMoonCmd,
    migrateGitleaksCmd,
    migrateKingfisherCmd,
    migrateSecretlintCmd,
    migrateVerify,
];

export default migrateCommands;
