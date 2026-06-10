import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { describe, expect, it } from "vitest";

import { applyCatalogUpdates, createBackup, hasBackup, restoreFromBackup } from "../../src/util/catalog";
import { CACHED_BACKUP_DIR } from "./catalog-test-helpers";

// --- Backup & Rollback ---

// Catalog backups live inside `<workspace>/node_modules/.cache/vis/backup/`
// so `findCacheDirSync` (which walks up looking for a package.json anchor)
// can resolve a writable cache directory. Each test root therefore needs a
// stub package.json even when the test only cares about the catalog file.

describe(createBackup, () => {
    it("should create pnpm backup", () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "package.json"), "{\"name\":\"root\"}");
        const filePath = join(temporaryDirectory, "pnpm-workspace.yaml");

        writeFileSync(filePath, "catalog:\n  react: ^18.0.0\n");

        const backupPath = createBackup(temporaryDirectory);

        expect(backupPath).toBe(join(temporaryDirectory, CACHED_BACKUP_DIR, "pnpm-workspace.yaml.bak"));
        expect(readFileSync(backupPath as string, "utf8")).toBe("catalog:\n  react: ^18.0.0\n");
    });

    it("should create bun backup", () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));
        const filePath = join(temporaryDirectory, "package.json");

        writeFileSync(filePath, "{\"workspaces\":{\"catalog\":{\"react\":\"^18.0.0\"}}}");

        const backupPath = createBackup(temporaryDirectory, "bun");

        expect(backupPath).toBe(join(temporaryDirectory, CACHED_BACKUP_DIR, "package.json.bak"));
        expect(readFileSync(backupPath as string, "utf8")).toContain("react");
    });

    it("should return undefined when file does not exist", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        expect(createBackup(temporaryDirectory)).toBeUndefined();
    });
});

describe(restoreFromBackup, () => {
    it("should restore pnpm file from backup", () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "package.json"), "{\"name\":\"root\"}");

        const filePath = join(temporaryDirectory, "pnpm-workspace.yaml");

        mkdirSync(join(temporaryDirectory, CACHED_BACKUP_DIR), { recursive: true });
        writeFileSync(join(temporaryDirectory, CACHED_BACKUP_DIR, "pnpm-workspace.yaml.bak"), "catalog:\n  react: ^18.0.0\n");
        writeFileSync(filePath, "catalog:\n  react: ^19.0.0\n");

        const restored = restoreFromBackup(temporaryDirectory);

        expect(restored).toBe(true);
        expect(readFileSync(filePath, "utf8")).toContain("^18.0.0");
    });

    it("should restore bun file from backup", () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));
        const filePath = join(temporaryDirectory, "package.json");

        writeFileSync(filePath, "{\"new\":true}");
        mkdirSync(join(temporaryDirectory, CACHED_BACKUP_DIR), { recursive: true });
        writeFileSync(join(temporaryDirectory, CACHED_BACKUP_DIR, "package.json.bak"), "{\"old\":true}");

        const restored = restoreFromBackup(temporaryDirectory, "bun");

        expect(restored).toBe(true);
        expect(readFileSync(filePath, "utf8")).toContain("\"old\"");
    });

    it("should return false when no backup exists", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "package.json"), "{\"name\":\"root\"}");

        expect(restoreFromBackup(temporaryDirectory)).toBe(false);
    });
});

describe(hasBackup, () => {
    it("should detect existing backup", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "package.json"), "{\"name\":\"root\"}");
        mkdirSync(join(temporaryDirectory, CACHED_BACKUP_DIR), { recursive: true });
        writeFileSync(join(temporaryDirectory, CACHED_BACKUP_DIR, "pnpm-workspace.yaml.bak"), "backup");

        expect(hasBackup(temporaryDirectory)).toBe(true);
    });

    it("should return false when no backup", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "package.json"), "{\"name\":\"root\"}");

        expect(hasBackup(temporaryDirectory)).toBe(false);
    });

    it("should check bun backup path", () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "package.json"), "{\"name\":\"root\"}");
        mkdirSync(join(temporaryDirectory, CACHED_BACKUP_DIR), { recursive: true });
        writeFileSync(join(temporaryDirectory, CACHED_BACKUP_DIR, "package.json.bak"), "backup");

        expect(hasBackup(temporaryDirectory, "bun")).toBe(true);
        expect(hasBackup(temporaryDirectory, "pnpm")).toBe(false);
    });
});

// --- applyCatalogUpdates with backup ---

describe("applyCatalogUpdates with backup", () => {
    it("should create backup by default", () => {
        expect.assertions(3);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "package.json"), "{\"name\":\"root\"}");

        const filePath = join(temporaryDirectory, "pnpm-workspace.yaml");

        writeFileSync(filePath, "catalog:\n  react: ^18.0.0\n");

        const backupPath = applyCatalogUpdates(temporaryDirectory, [
            {
                catalogName: "default",
                currentRange: "^18.0.0",
                newRange: "^19.0.0",
                packageName: "react",
                targetVersion: "19.0.0",
                updateType: "major",
            },
        ]);

        expect(backupPath).toBe(join(temporaryDirectory, CACHED_BACKUP_DIR, "pnpm-workspace.yaml.bak"));
        // Backup should contain the OLD content
        expect(readFileSync(backupPath as string, "utf8")).toContain("^18.0.0");
        // File should contain the NEW content
        expect(readFileSync(filePath, "utf8")).toContain("^19.0.0");
    });

    it("should skip backup when backup=false", () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "package.json"), "{\"name\":\"root\"}");

        const filePath = join(temporaryDirectory, "pnpm-workspace.yaml");

        writeFileSync(filePath, "catalog:\n  react: ^18.0.0\n");

        const backupPath = applyCatalogUpdates(
            temporaryDirectory,
            [
                {
                    catalogName: "default",
                    currentRange: "^18.0.0",
                    newRange: "^19.0.0",
                    packageName: "react",
                    targetVersion: "19.0.0",
                    updateType: "major",
                },
            ],
            undefined,
            false,
        );

        expect(backupPath).toBeUndefined();
        expect(readFileSync(filePath, "utf8")).toContain("^19.0.0");
    });

    it("should create backup for bun updates", () => {
        expect.assertions(3);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));
        const filePath = join(temporaryDirectory, "package.json");

        writeFileSync(
            filePath,
            `${JSON.stringify(
                {
                    workspaces: { catalog: { react: "^18.0.0" } },
                },
                undefined,
                2,
            )}\n`,
        );

        const backupPath = applyCatalogUpdates(
            temporaryDirectory,
            [
                {
                    catalogName: "default",
                    currentRange: "^18.0.0",
                    newRange: "^19.0.0",
                    packageName: "react",
                    targetVersion: "19.0.0",
                    updateType: "major",
                },
            ],
            "bun",
        );

        expect(backupPath).toBe(join(temporaryDirectory, CACHED_BACKUP_DIR, "package.json.bak"));
        expect(JSON.parse(readFileSync(backupPath as string, "utf8")).workspaces.catalog.react).toBe("^18.0.0");
        expect(JSON.parse(readFileSync(filePath, "utf8")).workspaces.catalog.react).toBe("^19.0.0");
    });
});
