import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { pail } from "../../io/logger";
import { resolveAdvisoryDbPath } from "../../security/advisories";
import type { AdvisoriesPruneOptions } from "./index";

const execute = async ({ fs, logger: _logger, options, workspaceRoot }: Toolbox<Console, AdvisoriesPruneOptions>): Promise<void> => {
    if (!workspaceRoot) {
        throw new Error("Could not determine workspace root. Run this command inside a workspace.");
    }

    const dbPath = options.db ?? resolveAdvisoryDbPath(workspaceRoot);
    const isJson = (options.format as string) === "json";

    if (!options.force) {
        pail.warn(`Prune is destructive. Will remove: ${dbPath}`);
        pail.info("Re-run with --force to proceed.");

        if (isJson) {
            process.stdout.write(`${JSON.stringify({ dbPath, reason: "needs --force", removed: false })}\n`);
        }

        return;
    }

    // SQLite WAL files (-wal, -shm) sit next to the main db file; remove them
    // too so a subsequent sync starts from a clean slate.
    const targets = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`];
    const removed: string[] = [];

    for (const target of targets) {
        try {
            await fs.rm(target, { force: true });
            removed.push(target);
        } catch {
            // best-effort
        }
    }

    if (isJson) {
        process.stdout.write(`${JSON.stringify({ dbPath, files: removed, removed: true })}\n`);

        return;
    }

    pail.success(`Removed ${dbPath}.`);
};

export const advisoriesPruneExecute: CommandExecute<Toolbox> = execute as CommandExecute<Toolbox>;
