import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { verifyMigration } from "../../../src/commands/migrate/verify";
import { cleanupTemporaryDirectory, createMockLogger, createTemporaryDirectory } from "../../test-helpers";

describe("migrate-verify", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = createTemporaryDirectory("vis-verify-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(tmpDir);
    });

    describe(verifyMigration, () => {
        it("returns no issues for a clean workspace", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ scripts: { build: "tsc" } }));

            const issues = verifyMigration(tmpDir, createMockLogger());

            expect(issues).toHaveLength(0);
        });

        it("flags gitleaks devDependency and script", () => {
            expect.assertions(2);

            writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ devDependencies: { gitleaks: "^8.0.0" }, scripts: { scan: "gitleaks detect ." } }));

            const issues = verifyMigration(tmpDir, createMockLogger());

            expect(issues.some((issue) => issue.kind === "devDep" && issue.detail.includes("gitleaks"))).toBe(true);
            expect(issues.some((issue) => issue.kind === "script" && issue.detail.includes("gitleaks"))).toBe(true);
        });

        it("flags leftover secretlint config file", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".secretlintrc.json"), "{}");

            const issues = verifyMigration(tmpDir, createMockLogger());

            expect(issues.some((issue) => issue.kind === "config" && issue.location === ".secretlintrc.json")).toBe(true);
        });

        it("flags unmigrated hook invocations", () => {
            expect.assertions(1);

            mkdirSync(join(tmpDir, ".husky"), { recursive: true });
            writeFileSync(join(tmpDir, ".husky", "pre-commit"), "#!/bin/sh\nsecretlint '**/*'\n");

            const issues = verifyMigration(tmpDir, createMockLogger());

            expect(issues.some((issue) => issue.kind === "hook" && issue.detail.includes("secretlint"))).toBe(true);
        });
    });
});
