import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { detectSecretlintConfig, detectSecretlintIgnore, extractRuleIds, migrateSecretlint } from "../../../src/commands/migrate/secretlint";
import { createMigrationReport } from "../../../src/commands/migrate/types";
import { cleanupTemporaryDirectory, createMockLogger, createTemporaryDirectory } from "../../test-helpers";

describe("migrate-secretlint", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = createTemporaryDirectory("vis-migrate-secretlint-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(tmpDir);
    });

    describe(detectSecretlintConfig, () => {
        it("returns undefined when no config exists", () => {
            expect.assertions(1);
            expect(detectSecretlintConfig(tmpDir)).toBeUndefined();
        });

        it("finds .secretlintrc.json", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".secretlintrc.json"), "{}");

            expect(detectSecretlintConfig(tmpDir)).toBe(".secretlintrc.json");
        });

        it("finds .secretlintrc.cjs", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".secretlintrc.cjs"), "module.exports = {};");

            expect(detectSecretlintConfig(tmpDir)).toBe(".secretlintrc.cjs");
        });
    });

    describe(detectSecretlintIgnore, () => {
        it("finds .secretlintignore", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".secretlintignore"), "dist/\n");

            expect(detectSecretlintIgnore(tmpDir)).toBe(".secretlintignore");
        });
    });

    describe(extractRuleIds, () => {
        it("pulls IDs out of a JSON config", () => {
            expect.assertions(2);

            writeFileSync(
                join(tmpDir, ".secretlintrc.json"),
                JSON.stringify({
                    rules: [{ id: "@secretlint/secretlint-rule-preset-recommend" }, { id: "@secretlint/secretlint-rule-aws" }],
                }),
            );

            const report = createMigrationReport();
            const ids = extractRuleIds(tmpDir, ".secretlintrc.json", report);

            expect(ids).toContain("@secretlint/secretlint-rule-preset-recommend");
            expect(ids).toContain("@secretlint/secretlint-rule-aws");
        });

        it("warns when config is JS (cannot parse)", () => {
            expect.assertions(2);

            writeFileSync(join(tmpDir, ".secretlintrc.cjs"), "module.exports = {};");

            const report = createMigrationReport();
            const ids = extractRuleIds(tmpDir, ".secretlintrc.cjs", report);

            expect(ids).toStrictEqual([]);
            expect(report.warnings.some((w) => w.includes(".secretlintrc.cjs"))).toBe(true);
        });
    });

    describe(migrateSecretlint, () => {
        it("returns false when nothing to migrate", () => {
            expect.assertions(1);

            const report = createMigrationReport();

            expect(migrateSecretlint(tmpDir, { dryRun: false }, createMockLogger(), report)).toBe(false);
        });

        it("removes @secretlint/* devDependencies", () => {
            expect.assertions(3);

            writeFileSync(join(tmpDir, ".secretlintrc.json"), JSON.stringify({ rules: [{ id: "@secretlint/secretlint-rule-aws" }] }));
            writeFileSync(
                join(tmpDir, "package.json"),
                JSON.stringify({
                    devDependencies: {
                        "@secretlint/secretlint-rule-aws": "^5.0.0",
                        "@secretlint/secretlint-rule-preset-recommend": "^5.0.0",
                        secretlint: "^5.0.0",
                        typescript: "^5.0.0",
                    },
                    scripts: { "scan:secrets": "secretlint '**/*'" },
                }),
            );

            const report = createMigrationReport();

            migrateSecretlint(tmpDir, { dryRun: false }, createMockLogger(), report);

            const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as {
                devDependencies?: Record<string, string>;
                scripts?: Record<string, string>;
            };

            expect(pkg.devDependencies?.secretlint).toBeUndefined();
            expect(pkg.devDependencies?.["@secretlint/secretlint-rule-aws"]).toBeUndefined();
            expect(pkg.devDependencies?.typescript).toBe("^5.0.0");
        });

        it("rewrites pre-commit hook", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".secretlintrc.json"), "{}");
            mkdirSync(join(tmpDir, ".husky"), { recursive: true });
            writeFileSync(join(tmpDir, ".husky", "pre-commit"), "#!/bin/sh\nsecretlint --secretlintrc .secretlintrc.json '**/*'\n");

            const report = createMigrationReport();

            migrateSecretlint(tmpDir, { dryRun: false }, createMockLogger(), report);

            const content = readFileSync(join(tmpDir, ".husky", "pre-commit"), "utf8");

            expect(content).toContain("vis secrets --staged");
        });

        it("removes the config file after migration", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".secretlintrc.json"), JSON.stringify({ rules: [] }));

            const report = createMigrationReport();

            migrateSecretlint(tmpDir, { dryRun: false }, createMockLogger(), report);

            expect(existsSync(join(tmpDir, ".secretlintrc.json"))).toBe(false);
        });

        it("dry-run leaves the config file in place", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".secretlintrc.json"), JSON.stringify({ rules: [] }));

            const report = createMigrationReport();

            migrateSecretlint(tmpDir, { dryRun: true }, createMockLogger(), report);

            expect(existsSync(join(tmpDir, ".secretlintrc.json"))).toBe(true);
        });

        it("surfaces manual step listing the old rule IDs", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".secretlintrc.json"), JSON.stringify({ rules: [{ id: "@secretlint/secretlint-rule-aws" }] }));

            const report = createMigrationReport();

            migrateSecretlint(tmpDir, { dryRun: false }, createMockLogger(), report);

            expect(report.manualSteps.some((s) => s.includes("@secretlint/secretlint-rule-aws"))).toBe(true);
        });
    });
});
