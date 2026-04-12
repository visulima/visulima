import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { migrateNx } from "../src/commands/migrate/nx";
import { createMigrationReport } from "../src/commands/migrate/types";

let tmpDir: string;

const logger = {
    info: () => {},
    warn: () => {},
};

beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vis-migrate-nx-"));
});

afterEach(() => {
    rmSync(tmpDir, { force: true, recursive: true });
});

describe(migrateNx, () => {
    it("should warn and skip when no nx.json exists", () => {
        expect.assertions(1);

        const report = createMigrationReport();

        migrateNx(tmpDir, {}, logger, report);

        expect(report.warnings).toContain("No nx.json at workspace root.");
    });

    it("should generate vis.config.ts from nx.json", () => {
        expect.assertions(3);

        writeFileSync(
            join(tmpDir, "nx.json"),
            JSON.stringify({
                namedInputs: { production: ["src/**"] },
                targetDefaults: { build: { cache: true, outputs: ["dist/**"] } },
            }),
        );

        const report = createMigrationReport();

        migrateNx(tmpDir, {}, logger, report);

        const configPath = join(tmpDir, "vis.config.ts");

        expect(existsSync(configPath)).toBe(true);

        const content = readFileSync(configPath, "utf8");

        expect(content).toContain("namedInputs");
        expect(content).toContain("targetDefaults");
    });

    it("should note default base branch when present", () => {
        expect.assertions(1);

        writeFileSync(
            join(tmpDir, "nx.json"),
            JSON.stringify({ defaultBase: "develop" }),
        );

        const report = createMigrationReport();

        migrateNx(tmpDir, {}, logger, report);

        expect(report.manualSteps.some((s) => s.includes("develop"))).toBe(true);
    });
});
