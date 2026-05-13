import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { migrateTurborepo } from "../../../src/commands/migrate/turborepo";
import { createMigrationReport } from "../../../src/commands/migrate/types";
import { cleanupTemporaryDirectory, createMockLogger, createTemporaryDirectory } from "../../test-helpers";

describe("migrate-turborepo", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = createTemporaryDirectory("vis-migrate-turbo-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(tmpDir);
    });

    describe(migrateTurborepo, () => {
        it("should warn and skip when no turbo.json exists", () => {
            expect.assertions(1);

            const report = createMigrationReport();

            migrateTurborepo(tmpDir, {}, createMockLogger(), report);

            expect(report.warnings).toContain("No turbo.json at workspace root.");
        });

        it("should generate vis.config.ts from turbo.json", () => {
            expect.assertions(3);

            writeFileSync(
                join(tmpDir, "turbo.json"),
                JSON.stringify({
                    globalDependencies: ["tsconfig.json"],
                    tasks: {
                        build: { cache: true, dependsOn: ["^build"], outputs: ["dist/**"] },
                        test: { dependsOn: ["build"], persistent: false },
                    },
                }),
            );

            const report = createMigrationReport();

            migrateTurborepo(tmpDir, {}, createMockLogger(), report);

            const configPath = join(tmpDir, "vis.config.ts");

            expect(existsSync(configPath)).toBe(true);

            const content = readFileSync(configPath, "utf8");

            expect(content).toContain("defineConfig");
            expect(content).toContain("tasks");
        });

        it("should convert ^build dependsOn to dependencies form", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "turbo.json"), JSON.stringify({ tasks: { build: { dependsOn: ["^build"] } } }));

            const report = createMigrationReport();

            migrateTurborepo(tmpDir, {}, createMockLogger(), report);

            const content = readFileSync(join(tmpDir, "vis.config.ts"), "utf8");

            expect(content).toContain("dependencies");
        });

        it("should warn about outputLogs", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "turbo.json"), JSON.stringify({ tasks: { build: { outputLogs: "hash-only" } } }));

            const report = createMigrationReport();

            migrateTurborepo(tmpDir, {}, createMockLogger(), report);

            expect(report.warnings.some((w) => w.includes("outputLogs"))).toBe(true);
        });

        it("should not write in dry-run mode", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "turbo.json"), JSON.stringify({ tasks: { build: {} } }));

            const report = createMigrationReport();

            migrateTurborepo(tmpDir, { dryRun: true }, createMockLogger(), report);

            expect(existsSync(join(tmpDir, "vis.config.ts"))).toBe(false);
        });
    });
});
