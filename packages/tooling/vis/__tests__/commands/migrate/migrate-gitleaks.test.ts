import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { convertBaseline, detectGitleaksBaseline, detectGitleaksConfig, detectGitleaksIgnore, migrateGitleaks } from "../../../src/commands/migrate/gitleaks";
import { createMigrationReport } from "../../../src/commands/migrate/types";
import { cleanupTemporaryDirectory, createMockLogger, createTemporaryDirectory } from "../../test-helpers";

let tmpDir: string;

beforeEach(() => {
    tmpDir = createTemporaryDirectory("vis-migrate-gitleaks-");
});

afterEach(() => {
    cleanupTemporaryDirectory(tmpDir);
});

describe(detectGitleaksConfig, () => {
    it("returns undefined when no config exists", () => {
        expect.assertions(1);
        expect(detectGitleaksConfig(tmpDir)).toBeUndefined();
    });

    it("finds gitleaks.toml", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, "gitleaks.toml"), 'title = "custom"\n');

        expect(detectGitleaksConfig(tmpDir)).toBe("gitleaks.toml");
    });

    it("finds .gitleaks.toml", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, ".gitleaks.toml"), 'title = "custom"\n');

        expect(detectGitleaksConfig(tmpDir)).toBe(".gitleaks.toml");
    });
});

describe(detectGitleaksIgnore, () => {
    it("returns undefined when missing", () => {
        expect.assertions(1);
        expect(detectGitleaksIgnore(tmpDir)).toBeUndefined();
    });

    it("returns path when .gitleaksignore exists", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, ".gitleaksignore"), "file.env:aws:1\n");

        expect(detectGitleaksIgnore(tmpDir)).toContain(".gitleaksignore");
    });
});

describe(detectGitleaksBaseline, () => {
    it("identifies gitleaks-format baseline via RuleID heuristic", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, "gitleaks-report.json"), JSON.stringify([{ File: "a.env", RuleID: "aws", StartLine: 1 }]));

        expect(detectGitleaksBaseline(tmpDir)).toContain("gitleaks-report.json");
    });

    it("ignores JSON arrays that don't look like gitleaks output", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, "gitleaks-report.json"), JSON.stringify([{ file: "a.env", ruleId: "aws", startLine: 1 }]));

        expect(detectGitleaksBaseline(tmpDir)).toBeUndefined();
    });
});

describe(convertBaseline, () => {
    it("maps PascalCase gitleaks fields to camelCase secret-scanner fields", () => {
        expect.assertions(5);

        const converted = convertBaseline([
            {
                Description: "AWS",
                EndColumn: 40,
                EndLine: 2,
                Entropy: 4.5,
                File: "a.env",
                Match: "AKIA...",
                RuleID: "aws-access-token",
                Secret: "AKIA...",
                StartColumn: 5,
                StartLine: 2,
                Tags: ["key"],
            },
        ]);

        expect(converted).toHaveLength(1);
        expect(converted[0]).toMatchObject({
            file: "a.env",
            ruleId: "aws-access-token",
            startLine: 2,
            tags: ["key"],
        });
        expect((converted[0] as Record<string, unknown>).startColumn).toBe(5);
        expect((converted[0] as Record<string, unknown>).endColumn).toBe(40);
        expect((converted[0] as Record<string, unknown>).entropy).toBe(4.5);
    });

    it("defaults missing fields to empty / zero", () => {
        expect.assertions(2);

        const converted = convertBaseline([{ RuleID: "r" }]) as Record<string, unknown>[];

        expect(converted[0]!.file).toBe("");
        expect(converted[0]!.startLine).toBe(0);
    });
});

describe(migrateGitleaks, () => {
    it("reports nothing to migrate when no artifacts are present", () => {
        expect.assertions(1);

        const report = createMigrationReport();
        const result = migrateGitleaks(tmpDir, { dryRun: false }, createMockLogger(), report);

        expect(result).toBe(false);
    });

    it("converts a gitleaks baseline to .secrets-baseline.json", () => {
        expect.assertions(3);

        writeFileSync(
            join(tmpDir, "gitleaks-report.json"),
            JSON.stringify([{ EndColumn: 10, EndLine: 1, File: "a.env", RuleID: "aws", StartColumn: 1, StartLine: 1 }]),
        );

        const report = createMigrationReport();

        migrateGitleaks(tmpDir, { dryRun: false }, createMockLogger(), report);

        const target = join(tmpDir, ".secrets-baseline.json");

        expect(existsSync(target)).toBe(true);

        const parsed = JSON.parse(readFileSync(target, "utf8")) as Record<string, unknown>[];

        expect(parsed).toHaveLength(1);
        expect(parsed[0]!.ruleId).toBe("aws");
    });

    it("rewrites gitleaks invocations in package.json scripts", () => {
        expect.assertions(2);

        // Trigger migration by planting a gitleaks artifact alongside the script.
        writeFileSync(join(tmpDir, ".gitleaksignore"), "a.env:aws:1\n");
        writeFileSync(
            join(tmpDir, "package.json"),
            JSON.stringify({
                devDependencies: { gitleaks: "^8.0.0" },
                scripts: {
                    "scan:secrets": "gitleaks detect --source .",
                },
            }),
        );

        const report = createMigrationReport();

        migrateGitleaks(tmpDir, { dryRun: false }, createMockLogger(), report);

        const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as {
            devDependencies?: Record<string, string>;
            scripts?: Record<string, string>;
        };

        expect(pkg.scripts?.["scan:secrets"]).toBe("vis secrets");
        expect(pkg.devDependencies?.gitleaks).toBeUndefined();
    });

    it("rewrites pre-commit hooks under .husky/", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, ".gitleaksignore"), "a.env:aws:1\n");
        mkdirSync(join(tmpDir, ".husky"), { recursive: true });
        writeFileSync(join(tmpDir, ".husky", "pre-commit"), "#!/bin/sh\ngitleaks protect --staged\n");

        const report = createMigrationReport();

        migrateGitleaks(tmpDir, { dryRun: false }, createMockLogger(), report);

        const content = readFileSync(join(tmpDir, ".husky", "pre-commit"), "utf8");

        expect(content).toContain("vis secrets --staged");
    });

    it("preserves custom gitleaks.toml by appending --config to rewritten commands", () => {
        expect.assertions(2);

        writeFileSync(join(tmpDir, "gitleaks.toml"), 'title = "custom"\n');
        writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ scripts: { scan: "gitleaks detect --source ." } }));

        const report = createMigrationReport();

        migrateGitleaks(tmpDir, { dryRun: false }, createMockLogger(), report);

        const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as { scripts?: Record<string, string> };

        expect(pkg.scripts?.scan).toContain("vis secrets --config gitleaks.toml");
        expect(pkg.scripts?.scan).not.toContain("gitleaks detect");
    });

    it("dry-run makes no changes on disk", () => {
        expect.assertions(2);

        writeFileSync(join(tmpDir, ".gitleaksignore"), "a.env:aws:1\n");
        writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ scripts: { test: "gitleaks detect ." } }));

        const report = createMigrationReport();

        migrateGitleaks(tmpDir, { dryRun: true }, createMockLogger(), report);

        const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as {
            scripts?: Record<string, string>;
        };

        expect(pkg.scripts?.test).toBe("gitleaks detect .");
        expect(existsSync(join(tmpDir, ".secrets-baseline.json"))).toBe(false);
    });
});
