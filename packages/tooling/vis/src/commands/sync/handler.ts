import { readFileSync } from "node:fs";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { buildCodeownersLines, renderCodeowners } from "../../codeowners";
import { discoverWorkspace } from "../../workspace";
import type { SyncOptions } from "./index";

const execute = async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, SyncOptions>): Promise<void> => {
    const kind = argument[0];

    if (!kind) {
        throw new Error("Missing sync kind. Usage: vis sync <kind> (known kinds: codeowners)");
    }

    if (!wsRoot) {
        throw new Error("Could not determine workspace root. Run inside a monorepo.");
    }

    if (kind !== "codeowners") {
        throw new Error(`Unknown sync kind: "${kind}". Known kinds: codeowners.`);
    }

    const { workspace } = discoverWorkspace(wsRoot, visConfig);
    const lines = buildCodeownersLines(workspace, visConfig?.codeowners);

    if (lines.length === 0) {
        logger.info("No `owners` entries found in any project. Nothing to sync.");

        return;
    }

    const rendered = renderCodeowners(lines, visConfig?.codeowners?.provider ?? "github");
    const outPath = options.out ? join(wsRoot, options.out) : join(wsRoot, "CODEOWNERS");

    if (options.check) {
        let existing = "";

        try {
            existing = readFileSync(outPath, "utf8");
        } catch (error: unknown) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                existing = "";
            } else {
                throw error;
            }
        }

        if (existing.trim() !== rendered.trim()) {
            logger.error(`${outPath} is out of date. Run \`vis sync codeowners\` to update it.`);
            process.exitCode = 1;

            return;
        }

        logger.info(`${outPath} is up to date.`);

        return;
    }

    writeFileSync(outPath, rendered);
    logger.info(`Wrote ${lines.length} entries to ${outPath}`);
};

export default execute as CommandExecute<Toolbox>;
