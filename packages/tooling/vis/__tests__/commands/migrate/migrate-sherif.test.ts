import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    buildPositiveLintCommand,
    detectSherifConfig,
    detectSherifInstallation,
    extractSherifFromPackageJson,
    migrateSherif,
    removeSherifFromPackageJson,
    RULE_MAP,
    translateIgnoreRules,
} from "../../../src/commands/migrate/sherif";
import { createMigrationReport } from "../../../src/commands/migrate/types";
import { cleanupTemporaryDirectory, createMockLogger, createTemporaryDirectory } from "../../test-helpers";

describe("migrate-sherif", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = createTemporaryDirectory("vis-migrate-sherif-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(tmpDir);
    });

    describe(detectSherifConfig, () => {
        it("returns undefined when nothing is configured", () => {
            expect.assertions(1);

            expect(detectSherifConfig(tmpDir)).toBeUndefined();
        });

        it("finds package.json#sherif", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ sherif: { "ignore-rules": ["root-package-private-field"] } }));

            expect(detectSherifConfig(tmpDir)).toBe("package.json");
        });

        it("ignores other package.json content", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "x" }));

            expect(detectSherifConfig(tmpDir)).toBeUndefined();
        });
    });

    describe(detectSherifInstallation, () => {
        it("detects sherif in devDependencies", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ devDependencies: { sherif: "^1.0.0" } }));

            expect(detectSherifInstallation(tmpDir)).toBe(true);
        });

        it("detects sherif in scripts even when not in deps", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ scripts: { lint: "sherif" } }));

            expect(detectSherifInstallation(tmpDir)).toBe(true);
        });

        it("returns false when sherif is absent everywhere", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ devDependencies: { typescript: "^5.0.0" } }));

            expect(detectSherifInstallation(tmpDir)).toBe(false);
        });
    });

    describe(extractSherifFromPackageJson, () => {
        it("returns the embedded sherif block", () => {
            expect.assertions(1);

            writeFileSync(
                join(tmpDir, "package.json"),
                JSON.stringify({ sherif: { "ignore-dependencies": ["react"], "ignore-rules": ["root-package-private-field"] } }),
            );

            expect(extractSherifFromPackageJson(tmpDir)?.["ignore-rules"]).toStrictEqual(["root-package-private-field"]);
        });

        it("returns undefined when no sherif key is present", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "x" }));

            expect(extractSherifFromPackageJson(tmpDir)).toBeUndefined();
        });
    });

    describe(translateIgnoreRules, () => {
        it("maps every covered sherif rule to its vis equivalent", () => {
            expect.assertions(2);

            const report = createMigrationReport();
            const out = translateIgnoreRules(
                {
                    "ignore-rules": [
                        "empty-dependencies",
                        "multiple-dependency-versions",
                        "non-existant-packages",
                        "packages-without-package-json",
                        "root-package-dependencies",
                        "root-package-manager-field",
                        "root-package-private-field",
                        "types-in-dependencies",
                        "unsync-similar-dependencies",
                    ],
                },
                report,
            );

            expect(out.visDisabled).toStrictEqual([
                "empty-deps",
                "workspace-versions",
                "dead-workspace-patterns",
                "missing-package-json",
                "root-deps",
                "root-package-manager",
                "root-private",
                "types-in-deps",
                "similar-deps",
            ]);
            expect(out.unmapped).toStrictEqual([]);
        });

        it("warns about unordered-dependencies (no vis lint equivalent — handled by sort-package-json)", () => {
            expect.assertions(2);

            const report = createMigrationReport();
            const out = translateIgnoreRules({ "ignore-rules": ["unordered-dependencies"] }, report);

            expect(out.visDisabled).toStrictEqual([]);
            expect(report.warnings.some((w) => w.includes("vis sort-package-json"))).toBe(true);
        });

        it("warns about unknown sherif rules", () => {
            expect.assertions(2);

            const report = createMigrationReport();
            const out = translateIgnoreRules({ "ignore-rules": ["totally-made-up"] }, report);

            expect(out.visDisabled).toStrictEqual([]);
            expect(report.warnings.some((w) => w.includes("totally-made-up"))).toBe(true);
        });

        it("returns empty result when ignore-rules is missing", () => {
            expect.assertions(2);

            const out = translateIgnoreRules({}, createMigrationReport());

            expect(out.visDisabled).toStrictEqual([]);
            expect(out.unmapped).toStrictEqual([]);
        });
    });

    describe(buildPositiveLintCommand, () => {
        it("returns the full vis lint command minus the disabled rules", () => {
            expect.assertions(1);

            expect(buildPositiveLintCommand(["root-private", "root-package-manager"])).toBe(
                "vis lint --empty-deps --workspace-versions --dead-workspace-patterns --missing-package-json --root-deps --types-in-deps --similar-deps",
            );
        });

        it("falls back to bare `vis lint` when every rule is disabled", () => {
            expect.assertions(1);

            const allRules = Object.values(RULE_MAP).filter((v): v is string => v !== undefined);

            expect(buildPositiveLintCommand(allRules)).toBe("vis lint");
        });
    });

    describe(removeSherifFromPackageJson, () => {
        it("strips the sherif block, devDependency, and matching scripts", () => {
            expect.assertions(5);

            writeFileSync(
                join(tmpDir, "package.json"),
                JSON.stringify({
                    devDependencies: { sherif: "^1.0.0", typescript: "^5.0.0" },
                    scripts: {
                        build: "tsc",
                        "lint:deps": "sherif",
                        "lint:deps:fix": "sherif --fix",
                    },
                    sherif: { "ignore-rules": ["root-package-private-field"] },
                }),
            );

            const result = removeSherifFromPackageJson(tmpDir);

            expect(result.configRemoved).toBe(true);
            expect(result.dependencyRemoved).toBe(true);
            expect(result.scriptCount).toBe(2);

            const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as {
                devDependencies?: Record<string, string>;
                scripts?: Record<string, string>;
                sherif?: unknown;
            };

            expect(pkg.scripts).toStrictEqual({ build: "tsc" });
            expect(pkg.devDependencies?.["sherif"]).toBeUndefined();
        });

        it("leaves package.json untouched when sherif is absent", () => {
            expect.assertions(3);

            writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "x", scripts: { build: "tsc" } }));

            const result = removeSherifFromPackageJson(tmpDir);

            expect(result.configRemoved).toBe(false);
            expect(result.dependencyRemoved).toBe(false);
            expect(result.scriptCount).toBe(0);
        });
    });

    describe(migrateSherif, () => {
        it("returns false when there is nothing to migrate", () => {
            expect.assertions(1);

            const report = createMigrationReport();

            expect(migrateSherif(tmpDir, { dryRun: false }, createMockLogger(), report)).toBe(false);
        });

        it("dry-run leaves package.json in place but reports the suggested replacement script", () => {
            expect.assertions(3);

            writeFileSync(
                join(tmpDir, "package.json"),
                JSON.stringify({
                    devDependencies: { sherif: "^1.0.0" },
                    scripts: { "lint:deps": "sherif" },
                    sherif: { "ignore-rules": ["root-package-private-field"] },
                }),
            );

            const logger = createMockLogger();
            const report = createMigrationReport();
            const ok = migrateSherif(tmpDir, { dryRun: true }, logger, report);

            expect(ok).toBe(true);

            // dry-run does NOT mutate package.json
            const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as { sherif?: unknown };

            expect(pkg.sherif).toBeDefined();
            expect(logger.infoMessages.some((m) => m.includes("vis lint --") && !m.includes("--root-private"))).toBe(true);
        });

        it("end-to-end strips package.json#sherif and surfaces ignore-* keys as manual steps", () => {
            expect.assertions(5);

            writeFileSync(
                join(tmpDir, "package.json"),
                JSON.stringify({
                    devDependencies: { sherif: "^1.0.0" },
                    scripts: { "lint:deps": "sherif" },
                    sherif: {
                        "ignore-dependencies": ["react"],
                        "ignore-packages": ["@my/legacy"],
                        "ignore-paths": ["packages/legacy"],
                        "ignore-rules": ["root-package-private-field"],
                    },
                }),
            );

            const report = createMigrationReport();
            const ok = migrateSherif(tmpDir, { dryRun: false }, createMockLogger(), report);

            expect(ok).toBe(true);

            const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as {
                devDependencies?: Record<string, string>;
                scripts?: Record<string, string>;
                sherif?: unknown;
            };

            expect(pkg.sherif).toBeUndefined();
            expect(pkg.devDependencies?.["sherif"]).toBeUndefined();
            // The ignore-rules → positive lint command lands as a manual step.
            expect(report.manualSteps.some((s) => s.includes("vis lint --") && !s.includes("--root-private"))).toBe(true);
            // ignore-paths / ignore-packages each surface as a manual step.
            expect(report.manualSteps.filter((s) => s.includes("ignore-")).length).toBeGreaterThanOrEqual(2);
        });

        it("creates a .bak before mutating package.json", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ devDependencies: { sherif: "^1.0.0" } }));

            const report = createMigrationReport();

            migrateSherif(tmpDir, { dryRun: false }, createMockLogger(), report);

            expect(existsSync(join(tmpDir, "package.json.bak"))).toBe(true);
        });
    });
});
