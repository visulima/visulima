import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { dirname, join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverWorkspace } from "../../src/config/workspace";

const write = (root: string, path: string, content: string): void => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
};

/**
 * A pyproject-only directory is a project named by `[project].name`, and it gets
 * the Python detector alone. A JS package keeps the JS detectors and never
 * gets the Python targets, even with a stray pyproject.toml next to it.
 */
describe("python projects as tasks", () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "vis-py-tasks-"));
        write(root, "pnpm-workspace.yaml", "packages:\n  - \"packages/*\"\n");
        write(root, "package.json", JSON.stringify({ name: "root", private: true }));
        write(root, "packages/py-lib/pyproject.toml", "[project]\nname = \"py-lib\"\nversion = \"0.1.0\"\n");
        write(root, "packages/py-lib/src/py_lib/__init__.py", "\n");
        write(root, "packages/web/package.json", JSON.stringify({ name: "web" }));
        write(root, "packages/web/pyproject.toml", "[tool.ruff]\nline-length = 100\n");
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("names a pyproject-only directory by [project].name", () => {
        expect.hasAssertions();

        const { workspace } = discoverWorkspace(root, {});

        expect(workspace.projects["py-lib"]).toBeDefined();
    });

    it("infers build and test for the Python project", () => {
        expect.hasAssertions();

        const { workspace } = discoverWorkspace(root, {});
        const targets = workspace.projects["py-lib"]?.targets ?? {};

        expect(targets["build"]?.command).toBe("uv build");
        expect(targets["test"]?.command).toBe("uv run pytest");
        expect(targets["test"]?.cache).toBe(true);
    });

    it("never gives a JS package the Python targets", () => {
        expect.hasAssertions();

        const { workspace } = discoverWorkspace(root, {});
        const commands = Object.values(workspace.projects["web"]?.targets ?? {}).map((target) => target.command);

        expect(commands.some((command) => typeof command === "string" && command.includes("pytest"))).toBe(false);
        expect(commands.some((command) => typeof command === "string" && command.includes("uv build"))).toBe(false);
    });
});
