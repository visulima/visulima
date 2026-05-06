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

        it("flags syncpack devDependency, script, hook, and config file", () => {
            expect.assertions(4);

            writeFileSync(
                join(tmpDir, "package.json"),
                JSON.stringify({ devDependencies: { syncpack: "^12.0.0" }, scripts: { "deps:lint": "syncpack lint" } }),
            );
            writeFileSync(join(tmpDir, ".syncpackrc.json"), "{}");
            mkdirSync(join(tmpDir, ".husky"), { recursive: true });
            writeFileSync(join(tmpDir, ".husky", "pre-commit"), "#!/bin/sh\nsyncpack lint\n");

            const issues = verifyMigration(tmpDir, createMockLogger());

            expect(issues.some((issue) => issue.kind === "devDep" && issue.detail.includes("syncpack"))).toBe(true);
            expect(issues.some((issue) => issue.kind === "script" && issue.detail.includes("syncpack"))).toBe(true);
            expect(issues.some((issue) => issue.kind === "hook" && issue.detail.includes("syncpack"))).toBe(true);
            expect(issues.some((issue) => issue.kind === "config" && issue.location === ".syncpackrc.json")).toBe(true);
        });

        it("flags TS-format syncpack configs that the migrate adapter cannot auto-remove", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "syncpack.config.ts"), "export default {};");

            const issues = verifyMigration(tmpDir, createMockLogger());

            expect(issues.some((issue) => issue.kind === "config" && issue.location === "syncpack.config.ts")).toBe(true);
        });

        it("flags syncpack invocations in CI workflow files", () => {
            expect.assertions(2);

            mkdirSync(join(tmpDir, ".github", "workflows"), { recursive: true });
            writeFileSync(join(tmpDir, ".github", "workflows", "ci.yml"), "jobs:\n  lint:\n    steps:\n      - run: pnpm syncpack lint\n");
            writeFileSync(join(tmpDir, ".gitlab-ci.yml"), "lint:\n  script:\n    - syncpack lint\n");

            const issues = verifyMigration(tmpDir, createMockLogger());

            expect(issues.some((issue) => issue.kind === "ci" && issue.location === ".github/workflows/ci.yml")).toBe(true);
            expect(issues.some((issue) => issue.kind === "ci" && issue.location === ".gitlab-ci.yml")).toBe(true);
        });

        it("flags sherif devDependency, script, package.json#sherif config, hook, and CI invocation", () => {
            expect.assertions(5);

            writeFileSync(
                join(tmpDir, "package.json"),
                JSON.stringify({
                    devDependencies: { sherif: "^1.0.0" },
                    scripts: { "lint:deps": "sherif" },
                    sherif: { "ignore-rules": ["root-package-private-field"] },
                }),
            );
            mkdirSync(join(tmpDir, ".husky"), { recursive: true });
            writeFileSync(join(tmpDir, ".husky", "pre-commit"), "#!/bin/sh\nsherif\n");
            mkdirSync(join(tmpDir, ".github", "workflows"), { recursive: true });
            writeFileSync(join(tmpDir, ".github", "workflows", "lint.yml"), "jobs:\n  lint:\n    steps:\n      - run: pnpm sherif\n");

            const issues = verifyMigration(tmpDir, createMockLogger());

            expect(issues.some((issue) => issue.kind === "devDep" && issue.detail.includes("sherif"))).toBe(true);
            expect(issues.some((issue) => issue.kind === "script" && issue.detail.includes("sherif"))).toBe(true);
            expect(issues.some((issue) => issue.kind === "config" && issue.detail.includes("sherif"))).toBe(true);
            expect(issues.some((issue) => issue.kind === "hook" && issue.detail.includes("sherif"))).toBe(true);
            expect(issues.some((issue) => issue.kind === "ci" && issue.detail.includes("sherif"))).toBe(true);
        });

        it("flags stray syncpack catalog protocol entries", () => {
            expect.assertions(2);

            writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "catalog:\n  syncpack: ^12.0.0\ncatalogs:\n  lint:\n    syncpack: ^12.0.0\n");
            writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ workspaces: { catalog: { syncpack: "^12.0.0" } } }));

            const issues = verifyMigration(tmpDir, createMockLogger());

            expect(issues.some((issue) => issue.kind === "catalog" && issue.location === "pnpm-workspace.yaml")).toBe(true);
            expect(issues.some((issue) => issue.kind === "catalog" && issue.location === "package.json")).toBe(true);
        });
    });
});
