import { render } from "@visulima/tui";
import isInCi from "is-in-ci";
import React from "react";

import type { MigrateItem } from "../../tui/components/migrate/MigrateStore";
import { MigrateStore } from "../../tui/components/migrate/MigrateStore";
import VisMigrateApp from "../../tui/components/migrate/VisMigrateApp";
import type { VisConfig } from "../../workspace";
import type { MigrationEntry } from "./registry";
import { buildProbeContext, getApplicableMigrations } from "./registry";
import { printSummary } from "./summary";
import type { MigrationReport } from "./types";
import { createMigrationReport } from "./types";

interface InteractiveLogger {
    info: (message: string) => void;
    warn: (message: string) => void;
}

interface InteractiveToolbox {
    logger: InteractiveLogger;
    visConfig?: VisConfig;
    workspaceRoot?: string;
}

const renderFallbackTable = (items: MigrateItem[], logger: InteractiveLogger): void => {
    if (items.length === 0) {
        logger.info("No applicable migrations detected in this workspace.");

        return;
    }

    logger.info("Detected migrations (non-interactive preview):\n");

    for (const item of items) {
        logger.info(`  • ${item.entry.title} — ${item.entry.description}`);

        for (const line of item.preview) {
            logger.info(`      ${line}`);
        }

        logger.info("");
    }

    logger.info("Run a specific migration with `vis migrate <name>` (e.g. `vis migrate deps`).");
};

export const runMigrateInteractive = async (toolbox: InteractiveToolbox): Promise<void> => {
    const root = toolbox.workspaceRoot ?? process.cwd();
    const visConfig = toolbox.visConfig ?? {};
    const context = buildProbeContext(root, visConfig);
    const applicable = getApplicableMigrations(context);

    const items: MigrateItem[] = applicable.map((entry) => {
        return {
            entry,
            preview: entry.probe(context),
        };
    });

    const isTTY = Boolean(process.stdout.isTTY) && !isInCi;

    if (!isTTY) {
        renderFallbackTable(items, toolbox.logger);

        return;
    }

    if (items.length === 0) {
        toolbox.logger.info("No applicable migrations detected in this workspace.");

        return;
    }

    const store = new MigrateStore(items);
    const autoExitConfig = visConfig.tui?.autoExit ?? false;
    const autoExitSeconds = autoExitConfig === true ? 3 : typeof autoExitConfig === "number" ? autoExitConfig : 0;

    const instance = render(
        React.createElement(VisMigrateApp, {
            autoExitSeconds,
            isDryRun: false,
            store,
        }),
        {
            alternateScreen: true,
            exitOnCtrlC: false,
            interactive: true,
            patchConsole: true,
        },
    );

    const exitResult = (await instance.waitUntilExit()) as MigrateItem[] | undefined;

    if (!exitResult || exitResult.length === 0) {
        toolbox.logger.info("No migrations selected — exiting.");

        return;
    }

    const report: MigrationReport = createMigrationReport();
    const failures: { entry: MigrationEntry; error: unknown }[] = [];

    for (const item of exitResult) {
        try {
            toolbox.logger.info(`── Applying ${item.entry.title} ──`);
            item.entry.apply(context, report, toolbox.logger);
            toolbox.logger.info("");
        } catch (error) {
            failures.push({ entry: item.entry, error });
            toolbox.logger.warn(`Failed to apply ${item.entry.title}: ${(error as Error).message}`);
        }
    }

    printSummary(report, toolbox.logger);

    if (failures.length > 0) {
        toolbox.logger.warn("");
        toolbox.logger.warn(`${String(failures.length)} migration(s) failed — see messages above.`);
        process.exitCode = 1;
    }
};
