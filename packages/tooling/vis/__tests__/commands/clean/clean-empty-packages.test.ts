import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { cleanWorkspace } from "@visulima/vis/native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(import("../../../src/io/logger"), () => {
    return { pail: { error: vi.fn(), info: vi.fn(), notice: vi.fn(), success: vi.fn(), warn: vi.fn() } };
});

const handlerPromise = import("../../../src/commands/clean/handler");

interface CleanToolbox {
    logger: { error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; log: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
    options: Record<string, unknown>;
    workspaceRoot: string;
}

const runClean = async (workspaceRoot: string, options: Record<string, unknown>): Promise<void> => {
    const { default: execute } = await handlerPromise;
    const toolbox: CleanToolbox = {
        logger: { error: vi.fn(), info: vi.fn(), log: vi.fn(), warn: vi.fn() },
        options,
        workspaceRoot,
    };

    // The handler only reads logger/options/workspaceRoot off the toolbox.
    await (execute as unknown as (tb: CleanToolbox) => Promise<void>)(toolbox);
};

describe("clean --empty-packages", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-clean-empty-"));
        process.exitCode = undefined;
    });

    afterEach(() => {
        if (existsSync(tmpDir)) {
            rmSync(tmpDir, { force: true, recursive: true });
        }

        process.exitCode = undefined;
    });

    it("removes a workspace directory that has no package.json", async () => {
        expect.assertions(2);

        writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");

        const real = join(tmpDir, "packages", "real");
        const ghost = join(tmpDir, "packages", "ghost");

        mkdirSync(real, { recursive: true });
        mkdirSync(ghost, { recursive: true });
        writeFileSync(join(real, "package.json"), JSON.stringify({ name: "real" }));

        await runClean(tmpDir, { emptyPackages: true });

        expect(existsSync(ghost)).toBe(false);
        expect(existsSync(real)).toBe(true);
    });

    it("leaves package-less directories untouched without the flag", async () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");

        const ghost = join(tmpDir, "packages", "ghost");

        mkdirSync(ghost, { recursive: true });

        await runClean(tmpDir, {});

        expect(existsSync(ghost)).toBe(true);
    });

    it("does not delete a grouping directory that still contains a package", async () => {
        expect.assertions(2);

        writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - 'packages/**'\n");

        // `packages/group` itself has no package.json, but `packages/group/pkg`
        // does — deleting the group would take the real package with it.
        const group = join(tmpDir, "packages", "group");
        const nested = join(group, "pkg");

        mkdirSync(nested, { recursive: true });
        writeFileSync(join(nested, "package.json"), JSON.stringify({ name: "pkg" }));

        await runClean(tmpDir, { emptyPackages: true });

        expect(existsSync(group)).toBe(true);
        expect(existsSync(join(nested, "package.json"))).toBe(true);
    });

    it("removes nothing under --dry-run", async () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");

        const ghost = join(tmpDir, "packages", "ghost");

        mkdirSync(ghost, { recursive: true });

        await runClean(tmpDir, { dryRun: true, emptyPackages: true });

        expect(existsSync(ghost)).toBe(true);
    });
});

describe("cleanWorkspace node_modules ordering", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-clean-order-"));
    });

    afterEach(() => {
        if (existsSync(tmpDir)) {
            rmSync(tmpDir, { force: true, recursive: true });
        }
    });

    it("removes the workspace root node_modules last", () => {
        expect.assertions(3);

        const rootNm = join(tmpDir, "node_modules");
        const pkgANm = join(tmpDir, "packages", "a", "node_modules");
        const pkgBNm = join(tmpDir, "packages", "b", "node_modules");

        for (const dir of [rootNm, pkgANm, pkgBNm]) {
            mkdirSync(dir, { recursive: true });
        }

        const result = cleanWorkspace(tmpDir, false);

        expect(result.removed).toHaveLength(3);
        // Root node_modules is intentionally removed last (see pm_clean.rs).
        expect(result.removed.at(-1)).toBe(rootNm);
        expect(result.removed.slice(0, -1)).toContain(pkgANm);
    });
});
