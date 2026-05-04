import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { migrateMoon } from "../../../src/commands/migrate/moon";
import { createMigrationReport } from "../../../src/commands/migrate/types";
import { cleanupTemporaryDirectory, createMockLogger, createTemporaryDirectory } from "../../test-helpers";

let tmpDir: string;

beforeEach(() => {
    tmpDir = createTemporaryDirectory("vis-migrate-moon-");
});

afterEach(() => {
    cleanupTemporaryDirectory(tmpDir);
});

describe(migrateMoon, () => {
    it("should warn and skip when no .moon/ directory exists", () => {
        expect.assertions(1);

        const report = createMigrationReport();

        migrateMoon(tmpDir, {}, createMockLogger(), report);

        expect(report.warnings).toContain("No moon tasks file at workspace root.");
    });

    it("should convert a tasks.yml to vis.config.ts", () => {
        expect.assertions(3);

        mkdirSync(join(tmpDir, ".moon"), { recursive: true });
        writeFileSync(
            join(tmpDir, ".moon", "tasks.yml"),
            [
                "fileGroups:",
                "  sources:",
                "    - 'src/**/*.ts'",
                "tasks:",
                "  build:",
                "    command: tsc",
                "    type: build",
                "    outputs:",
                "      - 'dist/**'",
                "",
            ].join("\n"),
        );

        const report = createMigrationReport();

        migrateMoon(tmpDir, {}, createMockLogger(), report);

        const configPath = join(tmpDir, "vis.config.ts");

        expect(existsSync(configPath)).toBe(true);

        const content = readFileSync(configPath, "utf8");

        expect(content).toContain("fileGroups");
        expect(content).toContain("targetDefaults");
    });

    it("should warn about unsupported task fields (env, platform, toolchain)", () => {
        expect.assertions(3);

        mkdirSync(join(tmpDir, ".moon"), { recursive: true });
        writeFileSync(
            join(tmpDir, ".moon", "tasks.yml"),
            ["tasks:", "  test:", "    command: vitest", "    platform: node", "    toolchain: node", "    env:", "      NODE_ENV: test", ""].join("\n"),
        );

        const report = createMigrationReport();

        migrateMoon(tmpDir, {}, createMockLogger(), report);

        expect(report.warnings.some((w) => w.includes("env"))).toBe(true);
        expect(report.warnings.some((w) => w.includes("platform"))).toBe(true);
        expect(report.warnings.some((w) => w.includes("toolchain"))).toBe(true);
    });

    it("should warn about top-level implicitDeps and taskOptions", () => {
        expect.assertions(2);

        mkdirSync(join(tmpDir, ".moon"), { recursive: true });
        writeFileSync(
            join(tmpDir, ".moon", "tasks.yml"),
            ["implicitDeps:", "  - '~:build'", "taskOptions:", "  cache: true", "tasks:", "  lint:", "    command: eslint", ""].join("\n"),
        );

        const report = createMigrationReport();

        migrateMoon(tmpDir, {}, createMockLogger(), report);

        expect(report.warnings.some((w) => w.includes("implicitDeps"))).toBe(true);
        expect(report.warnings.some((w) => w.includes("taskOptions"))).toBe(true);
    });

    it("should not write in dry-run mode", () => {
        expect.assertions(1);

        mkdirSync(join(tmpDir, ".moon"), { recursive: true });
        writeFileSync(join(tmpDir, ".moon", "tasks.yml"), "tasks:\n  build:\n    command: tsc\n");

        const report = createMigrationReport();

        migrateMoon(tmpDir, { dryRun: true }, createMockLogger(), report);

        expect(existsSync(join(tmpDir, "vis.config.ts"))).toBe(false);
    });
});
