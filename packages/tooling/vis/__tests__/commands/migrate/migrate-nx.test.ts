import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { migrateNx } from "../../../src/commands/migrate/nx";
import { createMigrationReport } from "../../../src/commands/migrate/types";
import { cleanupTemporaryDirectory, createMockLogger, createTemporaryDirectory } from "../../test-helpers";

let tmpDir: string;

beforeEach(() => {
    tmpDir = createTemporaryDirectory("vis-migrate-nx-");
});

afterEach(() => {
    cleanupTemporaryDirectory(tmpDir);
});

describe(migrateNx, () => {
    it("should warn and skip when no nx.json exists", () => {
        expect.assertions(1);

        const report = createMigrationReport();

        migrateNx(tmpDir, {}, createMockLogger(), report);

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

        migrateNx(tmpDir, {}, createMockLogger(), report);

        const configPath = join(tmpDir, "vis.config.ts");

        expect(existsSync(configPath)).toBe(true);

        const content = readFileSync(configPath, "utf8");

        expect(content).toContain("namedInputs");
        expect(content).toContain("targetDefaults");
    });

    it("should note default base branch when present", () => {
        expect.assertions(3);

        writeFileSync(join(tmpDir, "nx.json"), JSON.stringify({ defaultBase: "develop" }));

        const report = createMigrationReport();

        migrateNx(tmpDir, {}, createMockLogger(), report);

        const baseStep = report.manualSteps.find((s) => s.includes("default base branch"));

        expect(baseStep).toBeDefined();
        expect(baseStep).toContain("develop");
        expect(baseStep).toContain("--base");
    });
});
