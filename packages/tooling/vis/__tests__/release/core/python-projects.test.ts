import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverPythonProjects } from "../../../src/release/core/python-projects";

/**
 * uv workspace discovery. Members come from `[tool.uv.workspace].members`,
 * a `workspace = true` source becomes a graph edge, `Private :: Do Not Upload`
 * makes a project private, and a dynamic version is refused rather than skipped.
 */
describe("python-projects: discoverPythonProjects", () => {
    let cwd: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-py-discover-")));
        write("pyproject.toml", "[tool.uv.workspace]\nmembers = [\"packages/*\"]\n");
        write(
            "packages/core/pyproject.toml",
            "[project]\nname = \"core-lib\"\nversion = \"1.0.0\"\n",
        );
        write(
            "packages/app/pyproject.toml",
            [
                "[project]",
                "name = \"app\"",
                "version = \"0.1.0\"",
                "dependencies = [\"core_lib>=1.0\"]",
                "classifiers = [\"Private :: Do Not Upload\"]",
                "",
                "[tool.uv.sources]",
                "core-lib = { workspace = true }",
                "",
            ].join("\n"),
        );
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("discovers members with the declared names and private flags", async () => {
        expect.hasAssertions();

        const projects = await discoverPythonProjects({ claimedDirs: new Set(), cwd });

        expect(projects.map((project) => project.name).sort()).toStrictEqual(["app", "core-lib"]);
        expect(projects.find((project) => project.name === "app")).toMatchObject({ ecosystem: "python", private: true, version: "0.1.0" });
    });

    it("records only workspace-sourced dependencies as graph edges", async () => {
        expect.hasAssertions();

        const projects = await discoverPythonProjects({ claimedDirs: new Set(), cwd });

        expect(projects.find((project) => project.name === "app")?.manifest.dependencies).toStrictEqual({ "core-lib": ">=1.0" });
    });

    it("honours exclude patterns as globs", async () => {
        expect.hasAssertions();

        write("pyproject.toml", "[tool.uv.workspace]\nmembers = [\"packages/*\"]\nexclude = [\"packages/co*\"]\n");
        write("packages/core/pyproject.toml", "[project]\nname = \"core-lib\"\ndynamic = [\"version\"]\n");

        const projects = await discoverPythonProjects({ claimedDirs: new Set(), cwd });

        expect(projects.map((project) => project.name)).toStrictEqual(["app"]);
    });

    it("refuses a dynamic version", async () => {
        expect.hasAssertions();

        write("packages/core/pyproject.toml", "[project]\nname = \"core-lib\"\ndynamic = [\"version\"]\n");

        await expect(discoverPythonProjects({ claimedDirs: new Set(), cwd })).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("returns nothing without a root pyproject.toml", async () => {
        expect.hasAssertions();

        rmSync(join(cwd, "pyproject.toml"));

        await expect(discoverPythonProjects({ claimedDirs: new Set(), cwd })).resolves.toStrictEqual([]);
    });
});
