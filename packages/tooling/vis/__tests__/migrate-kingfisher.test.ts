import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { detectKingfisherBaseline, detectKingfisherRules, migrateKingfisher, parseKingfisherBaseline } from "../src/commands/migrate/kingfisher";
import { createMigrationReport } from "../src/commands/migrate/types";
import { cleanupTemporaryDirectory, createMockLogger, createTemporaryDirectory } from "./test-helpers";

let tmpDir: string;

beforeEach(() => {
    tmpDir = createTemporaryDirectory("vis-migrate-kingfisher-");
});

afterEach(() => {
    cleanupTemporaryDirectory(tmpDir);
});

describe(detectKingfisherBaseline, () => {
    it("returns undefined when no baseline exists", () => {
        expect.assertions(1);
        expect(detectKingfisherBaseline(tmpDir)).toBeUndefined();
    });

    it.each(["kingfisher-baseline.yaml", ".kingfisher-baseline.yaml", "kingfisher-baseline.yml", ".kingfisher-baseline.yml"])("finds %s", (name) => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, name), "ExactFindings:\n  matches: []\n");

        expect(detectKingfisherBaseline(tmpDir)).toContain(name);
    });
});

describe(detectKingfisherRules, () => {
    it("returns undefined when no rules file exists", () => {
        expect.assertions(1);
        expect(detectKingfisherRules(tmpDir)).toBeUndefined();
    });

    it("finds kingfisher-rules.yml", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, "kingfisher-rules.yml"), "rules: []\n");

        expect(detectKingfisherRules(tmpDir)).toContain("kingfisher-rules.yml");
    });
});

describe(parseKingfisherBaseline, () => {
    it("extracts filepath/fingerprint/linenum from the upstream shape", () => {
        expect.assertions(2);

        const yaml = [
            "ExactFindings:",
            "  matches:",
            "    - filepath: src/app.ts",
            "      fingerprint: abcdef0123456789",
            "      linenum: 42",
            "      lastupdated: 2025-01-01T00:00:00Z",
            "    - filepath: src/db.ts",
            "      fingerprint: 0123456789abcdef",
            "      linenum: 7",
            "",
        ].join("\n");

        const records = parseKingfisherBaseline(yaml);

        expect(records).toHaveLength(2);
        expect(records[0]).toStrictEqual({ filepath: "src/app.ts", fingerprint: "abcdef0123456789", linenum: 42 });
    });

    it("ignores comments and blank lines", () => {
        expect.assertions(1);

        const yaml = [
            "# comment line",
            "ExactFindings:",
            "  matches:",
            "    - filepath: src/only.ts  # trailing comment",
            "      fingerprint: ff00ff00ff00ff00",
            "      linenum: 1",
            "",
            "",
        ].join("\n");

        expect(parseKingfisherBaseline(yaml)).toStrictEqual([{ filepath: "src/only.ts", fingerprint: "ff00ff00ff00ff00", linenum: 1 }]);
    });

    it("returns an empty array for baselines with no matches", () => {
        expect.assertions(1);
        expect(parseKingfisherBaseline("ExactFindings:\n  matches: []\n")).toStrictEqual([]);
    });

    it("strips quotes around string values", () => {
        expect.assertions(1);

        const yaml = ["ExactFindings:", "  matches:", '    - filepath: "quoted/path.ts"', "      fingerprint: 'singlequoted0000'", "      linenum: 5", ""].join(
            "\n",
        );

        expect(parseKingfisherBaseline(yaml)[0]?.filepath).toBe("quoted/path.ts");
    });
});

describe(migrateKingfisher, () => {
    it("reports no artifacts when the workspace is clean", () => {
        expect.assertions(2);

        writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "test", scripts: { build: "tsc" } }));

        const logger = createMockLogger();
        const report = createMigrationReport();
        const changed = migrateKingfisher(tmpDir, { dryRun: false }, logger, report);

        expect(changed).toBe(false);
        expect(logger.infoMessages.join("\n")).toContain("No Kingfisher artifacts found");
    });

    it("stays silent when called in silent mode on a clean workspace", () => {
        expect.assertions(2);

        writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "test", scripts: {} }));

        const logger = createMockLogger();
        const report = createMigrationReport();
        const changed = migrateKingfisher(tmpDir, { dryRun: false, silent: true }, logger, report);

        expect(changed).toBe(false);
        expect(logger.infoMessages).toStrictEqual([]);
    });

    it("converts a baseline to a placeholder `.secrets-baseline.json` and records a manual follow-up", () => {
        expect.assertions(4);

        writeFileSync(
            join(tmpDir, "kingfisher-baseline.yaml"),
            ["ExactFindings:", "  matches:", "    - filepath: a.ts", "      fingerprint: aaaaaaaaaaaaaaaa", "      linenum: 10", ""].join("\n"),
        );
        writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "t", scripts: {} }));

        const logger = createMockLogger();
        const report = createMigrationReport();
        const changed = migrateKingfisher(tmpDir, { dryRun: false }, logger, report);

        expect(changed).toBe(true);

        const target = join(tmpDir, ".secrets-baseline.json");

        expect(existsSync(target)).toBe(true);

        const parsed = JSON.parse(readFileSync(target, "utf8")) as { _kingfisherMigration?: unknown; file?: string; startLine?: number }[];

        expect(parsed[0]).toMatchObject({ file: "a.ts", startLine: 10 });
        expect(report.manualSteps.some((step) => step.includes("--update-baseline"))).toBe(true);
    });

    it("leaves an existing `.secrets-baseline.json` alone and warns about the collision", () => {
        expect.assertions(2);

        writeFileSync(
            join(tmpDir, "kingfisher-baseline.yaml"),
            ["ExactFindings:", "  matches:", "    - filepath: a.ts", "      fingerprint: aaaaaaaaaaaaaaaa", "      linenum: 10", ""].join("\n"),
        );
        writeFileSync(join(tmpDir, ".secrets-baseline.json"), "[]\n");
        writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "t", scripts: {} }));

        const logger = createMockLogger();
        const report = createMigrationReport();

        migrateKingfisher(tmpDir, { dryRun: false }, logger, report);

        expect(readFileSync(join(tmpDir, ".secrets-baseline.json"), "utf8")).toBe("[]\n");
        expect(report.warnings.some((w) => w.includes("already exists"))).toBe(true);
    });

    it("rewrites `kingfisher scan` / `kingfisher validate` in package.json scripts", () => {
        expect.assertions(3);

        writeFileSync(
            join(tmpDir, "package.json"),
            JSON.stringify({
                name: "t",
                scripts: {
                    scan: "kingfisher scan --path .",
                    "scan:validate": "kingfisher validate --rules/aws.yml",
                },
            }),
        );

        const logger = createMockLogger();
        const report = createMigrationReport();

        migrateKingfisher(tmpDir, { dryRun: false }, logger, report);

        const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as { scripts: Record<string, string> };

        expect(pkg.scripts.scan).toBe("vis secrets");
        expect(pkg.scripts["scan:validate"]).toBe("vis secrets --validate");
        expect(report.perMigration.kingfisher?.rewrittenScriptCount).toBeGreaterThan(0);
    });

    it("removes kingfisher devDependencies when present", () => {
        expect.assertions(2);

        writeFileSync(
            join(tmpDir, "package.json"),
            JSON.stringify({
                devDependencies: { kingfisher: "^1.0.0", typescript: "^5.0.0" },
                name: "t",
                scripts: { scan: "kingfisher scan" },
            }),
        );

        const logger = createMockLogger();
        const report = createMigrationReport();

        migrateKingfisher(tmpDir, { dryRun: false }, logger, report);

        const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as { devDependencies?: Record<string, string> };

        expect(pkg.devDependencies).not.toHaveProperty("kingfisher");
        expect(pkg.devDependencies).toHaveProperty("typescript");
    });

    it("rewrites `.husky/pre-commit` hooks that call kingfisher", () => {
        expect.assertions(2);

        writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "t", scripts: {} }));
        mkdirSync(join(tmpDir, ".husky"), { recursive: true });
        writeFileSync(join(tmpDir, ".husky", "pre-commit"), "#!/usr/bin/env sh\nkingfisher scan --staged\n");

        const logger = createMockLogger();
        const report = createMigrationReport();

        migrateKingfisher(tmpDir, { dryRun: false }, logger, report);

        const hook = readFileSync(join(tmpDir, ".husky", "pre-commit"), "utf8");

        expect(hook).toContain("vis secrets --staged");
        expect(report.gitHooksConfigured).toBe(true);
    });

    it("wires `--config` through to scripts and hooks when a custom rules file is present", () => {
        expect.assertions(2);

        writeFileSync(join(tmpDir, "kingfisher-rules.yml"), "rules: []\n");
        writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "t", scripts: { scan: "kingfisher scan --rules-path kingfisher-rules.yml" } }));
        mkdirSync(join(tmpDir, ".husky"), { recursive: true });
        writeFileSync(join(tmpDir, ".husky", "pre-commit"), "kingfisher scan --staged --rules-path kingfisher-rules.yml\n");

        const logger = createMockLogger();
        const report = createMigrationReport();

        migrateKingfisher(tmpDir, { dryRun: false }, logger, report);

        const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as { scripts: Record<string, string> };
        const hook = readFileSync(join(tmpDir, ".husky", "pre-commit"), "utf8");

        expect(pkg.scripts.scan).toBe("vis secrets --config kingfisher-rules.yml");
        expect(hook).toContain("vis secrets --staged --config kingfisher-rules.yml");
    });

    it("flags `kingfisher:ignore` marker replacement and CI-workflow review as manual steps", () => {
        expect.assertions(2);

        writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "t", scripts: { scan: "kingfisher scan" } }));

        const logger = createMockLogger();
        const report = createMigrationReport();

        migrateKingfisher(tmpDir, { dryRun: false }, logger, report);

        expect(report.manualSteps.some((step) => step.toLowerCase().includes("kingfisher:ignore"))).toBe(true);
        expect(report.manualSteps.some((step) => step.toLowerCase().includes("workflows"))).toBe(true);
    });

    it("respects dry-run mode: no file mutations + logs preview", () => {
        expect.assertions(3);

        writeFileSync(
            join(tmpDir, "kingfisher-baseline.yaml"),
            ["ExactFindings:", "  matches:", "    - filepath: a.ts", "      fingerprint: aaaaaaaaaaaaaaaa", "      linenum: 1", ""].join("\n"),
        );
        writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "t", scripts: { scan: "kingfisher scan" } }));

        const logger = createMockLogger();
        const report = createMigrationReport();

        migrateKingfisher(tmpDir, { dryRun: true }, logger, report);

        expect(existsSync(join(tmpDir, ".secrets-baseline.json"))).toBe(false);
        expect(JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")).scripts.scan).toBe("kingfisher scan");
        expect(logger.infoMessages.join("\n")).toContain("[dry-run]");
    });
});
