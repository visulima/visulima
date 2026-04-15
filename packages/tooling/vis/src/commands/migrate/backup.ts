import { copyFileSync, existsSync } from "node:fs";

import type { MigrationReport } from "./types";

/**
 * Create a `.bak` sibling alongside `path` before we mutate/delete it. We only
 * back up on first touch — subsequent writes to the same file in a single
 * migration run don't clobber the original snapshot. When `report` is provided
 * the backup path is recorded for the migration summary.
 */
export const backupFile = (path: string, report?: MigrationReport): void => {
    if (!existsSync(path)) {
        return;
    }

    const backupPath = `${path}.bak`;

    if (existsSync(backupPath) || (report?.backupsCreated.includes(backupPath) ?? false)) {
        return;
    }

    copyFileSync(path, backupPath);

    if (report) {
        report.backupsCreated.push(backupPath);
    }
};
