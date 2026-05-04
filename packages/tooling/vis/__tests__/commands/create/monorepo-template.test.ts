import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { executeMonorepoTemplate } from "../../../src/commands/create/templates/monorepo";
import type { ExecutionContext } from "../../../src/commands/create/templates/types";

// Mock output module to avoid dependency on @visulima/ansi (requires build)
vi.mock(import("../../../src/output"), () => {
    return {
        info: vi.fn(),
        success: vi.fn(),
        warn: vi.fn(),
    };
});

describe(executeMonorepoTemplate, () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-monorepo-test-"));
    });

    afterEach(() => {
        rmSync(tmpDir, { force: true, recursive: true });
    });

    const makeContext = (targetDir: string): ExecutionContext => {
        return {
            cwd: tmpDir,
            inMonorepo: false,
            logger: console,
            pm: { name: "pnpm", version: "10.0.0" },
            projectName: "my-workspace",
            targetDir,
        };
    };

    it("should create the monorepo directory structure", () => {
        expect.assertions(3);

        const targetDir = join(tmpDir, "my-workspace");
        const code = executeMonorepoTemplate(makeContext(targetDir));

        expect(code).toBe(0);
        expect(existsSync(join(targetDir, "apps"))).toBe(true);
        expect(existsSync(join(targetDir, "packages"))).toBe(true);
    });

    it("should create root package.json with workspace name and pnpm", () => {
        expect.assertions(4);

        const targetDir = join(tmpDir, "my-workspace");

        executeMonorepoTemplate(makeContext(targetDir));

        const pkg = JSON.parse(readFileSync(join(targetDir, "package.json"), "utf8"));

        expect(pkg.name).toBe("my-workspace");
        expect(pkg.private).toBe(true);
        expect(pkg.type).toBe("module");
        // Monorepo always uses pnpm (generates pnpm-workspace.yaml)
        expect(pkg.packageManager).toBe("pnpm@latest");
    });

    it("should create pnpm-workspace.yaml", () => {
        expect.assertions(2);

        const targetDir = join(tmpDir, "my-workspace");

        executeMonorepoTemplate(makeContext(targetDir));

        const content = readFileSync(join(targetDir, "pnpm-workspace.yaml"), "utf8");

        expect(content).toContain("apps/*");
        expect(content).toContain("packages/*");
    });

    it("should create .gitignore", () => {
        expect.assertions(2);

        const targetDir = join(tmpDir, "my-workspace");

        executeMonorepoTemplate(makeContext(targetDir));

        const content = readFileSync(join(targetDir, ".gitignore"), "utf8");

        expect(content).toContain("node_modules");
        expect(content).toContain("dist");
    });

    it("should create .editorconfig", () => {
        expect.assertions(1);

        const targetDir = join(tmpDir, "my-workspace");

        executeMonorepoTemplate(makeContext(targetDir));

        expect(existsSync(join(targetDir, ".editorconfig"))).toBe(true);
    });

    it("should create README.md with project name", () => {
        expect.assertions(1);

        const targetDir = join(tmpDir, "my-workspace");

        executeMonorepoTemplate(makeContext(targetDir));

        const content = readFileSync(join(targetDir, "README.md"), "utf8");

        expect(content).toContain("# my-workspace");
    });
});
