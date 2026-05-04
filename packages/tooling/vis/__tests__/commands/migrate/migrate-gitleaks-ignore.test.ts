import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { migrateGitleaks } from "../../../src/commands/migrate/gitleaks";
import { createMigrationReport } from "../../../src/commands/migrate/types";
import { cleanupTemporaryDirectory, createMockLogger, createTemporaryDirectory } from "../../test-helpers";

let tmpDir: string;

beforeEach(() => {
    tmpDir = createTemporaryDirectory("vis-migrate-gl-ignore-");
});

afterEach(() => {
    cleanupTemporaryDirectory(tmpDir);
});

describe(".gitleaksignore → baseline migration", () => {
    it("converts fingerprint lines into .secrets-baseline.json and removes the ignore file", () => {
        expect.assertions(4);

        writeFileSync(
            join(tmpDir, ".gitleaksignore"),
            ["# skip known leaks", "src/app.env:aws-access-token:42", "packages/lib/env.ts:github-pat:17", ""].join("\n"),
        );

        const report = createMigrationReport();

        migrateGitleaks(tmpDir, { dryRun: false }, createMockLogger(), report);

        const baselinePath = join(tmpDir, ".secrets-baseline.json");

        expect(existsSync(join(tmpDir, ".gitleaksignore"))).toBe(false);
        expect(existsSync(baselinePath)).toBe(true);

        const parsed = JSON.parse(readFileSync(baselinePath, "utf8")) as Record<string, unknown>[];

        expect(parsed).toHaveLength(2);
        expect(parsed[0]).toMatchObject({ file: "src/app.env", ruleId: "aws-access-token", startLine: 42 });
    });

    it("dedupes against existing baseline entries", () => {
        expect.assertions(1);

        writeFileSync(
            join(tmpDir, ".secrets-baseline.json"),
            JSON.stringify([
                {
                    description: "",
                    endColumn: 0,
                    endLine: 10,
                    entropy: 0,
                    file: "src/a.env",
                    match: "",
                    ruleId: "aws-access-token",
                    secret: "",
                    startColumn: 0,
                    startLine: 10,
                    tags: [],
                },
            ]),
        );
        writeFileSync(join(tmpDir, ".gitleaksignore"), "src/a.env:aws-access-token:10\nsrc/b.env:github-pat:4\n");

        const report = createMigrationReport();

        migrateGitleaks(tmpDir, { dryRun: false }, createMockLogger(), report);

        const parsed = JSON.parse(readFileSync(join(tmpDir, ".secrets-baseline.json"), "utf8")) as Record<string, unknown>[];

        // Two total: the pre-existing one + the one new fingerprint (other is a dup).
        expect(parsed).toHaveLength(2);
    });

    it("dry-run keeps the .gitleaksignore in place", () => {
        expect.assertions(2);

        writeFileSync(join(tmpDir, ".gitleaksignore"), "src/a.env:aws-access-token:1\n");

        const report = createMigrationReport();

        migrateGitleaks(tmpDir, { dryRun: true }, createMockLogger(), report);

        expect(existsSync(join(tmpDir, ".gitleaksignore"))).toBe(true);
        expect(existsSync(join(tmpDir, ".secrets-baseline.json"))).toBe(false);
    });
});
