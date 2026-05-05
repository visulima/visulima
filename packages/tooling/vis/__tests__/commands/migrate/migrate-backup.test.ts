import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { backupFile } from "../../../src/commands/migrate/backup";
import { createMigrationReport } from "../../../src/commands/migrate/types";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

describe("migrate-backup", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = createTemporaryDirectory("vis-backup-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(tmpDir);
    });

    describe(backupFile, () => {
        it("creates a .bak sibling", () => {
            expect.assertions(3);

            const path = join(tmpDir, "a.json");

            writeFileSync(path, '{"k":1}');

            const report = createMigrationReport();

            backupFile(path, report);

            expect(existsSync(`${path}.bak`)).toBe(true);
            expect(readFileSync(`${path}.bak`, "utf8")).toBe('{"k":1}');
            expect(report.backupsCreated).toContain(`${path}.bak`);
        });

        it("does not overwrite an existing .bak", () => {
            expect.assertions(1);

            const path = join(tmpDir, "a.json");

            writeFileSync(path, "updated");
            writeFileSync(`${path}.bak`, "original");

            const report = createMigrationReport();

            backupFile(path, report);

            expect(readFileSync(`${path}.bak`, "utf8")).toBe("original");
        });

        it("is a no-op when the source file doesn't exist", () => {
            expect.assertions(2);

            const report = createMigrationReport();

            backupFile(join(tmpDir, "missing"), report);

            expect(report.backupsCreated).toHaveLength(0);
            expect(existsSync(join(tmpDir, "missing.bak"))).toBe(false);
        });
    });
});
