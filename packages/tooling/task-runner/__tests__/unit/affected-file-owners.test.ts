import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAffectedProjects } from "../../src/affected";
import type { ProjectConfiguration, ProjectGraph } from "../../src/types";

const projects: Record<string, ProjectConfiguration> = {
    api: { root: "packages/api" },
    core: { root: "crates/core" },
};

const projectGraph: ProjectGraph = {
    dependencies: { api: [], core: [] },
    nodes: {
        api: { data: { root: "packages/api" }, name: "api", type: "library" },
        core: { data: { root: "crates/core" }, name: "core", type: "library" },
    },
};

describe("getAffectedProjects fileOwners", () => {
    let root: string;

    beforeEach(() => {
        // A git hook (pre-commit) exports GIT_DIR / GIT_INDEX_FILE, which would
        // point the fixture's git calls at the enclosing repository.
        for (const key of Object.keys(process.env).filter((name) => name.startsWith("GIT_"))) {
            vi.stubEnv(key, undefined);
        }

        root = mkdtempSync(join(tmpdir(), "tr-affected-owners-"));

        execFileSync("git", ["init", "--initial-branch=main"], { cwd: root, stdio: "pipe" });
        execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=T", "commit", "--allow-empty", "-m", "initial"], { cwd: root, stdio: "pipe" });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        rmSync(root, { force: true, recursive: true });
    });

    it("should attribute an owned root file to its owners instead of the whole workspace", async () => {
        expect.assertions(2);

        const result = await getAffectedProjects({
            additionalChangedFiles: ["Cargo.lock"],
            base: "HEAD",
            fileOwners: { "Cargo.lock": ["core"] },
            head: "HEAD",
            projectGraph,
            projects,
            workspaceRoot: root,
        });

        expect(result.changedProjects).toStrictEqual(["core"]);
        expect(result.affectedProjects).toStrictEqual(["core"]);
    });

    it("should apply fileOwners, project roots and ignoredFiles together, in that order", async () => {
        expect.assertions(3);

        const result = await getAffectedProjects({
            additionalChangedFiles: ["Cargo.lock", "README.md", "packages/api/src/index.ts"],
            base: "HEAD",
            fileOwners: { "Cargo.lock": ["core"] },
            head: "HEAD",
            // Every changed file matches an ignore glob, but owners and project roots win.
            ignoredFiles: ["*.md", "Cargo.*", "packages/**"],
            projectGraph: { ...projectGraph, dependencies: { ...projectGraph.dependencies, web: [] } },
            projects: { ...projects, web: { root: "packages/web" } },
            workspaceRoot: root,
        });

        expect([...result.changedProjects].sort()).toStrictEqual(["api", "core"]);
        expect([...result.affectedProjects].sort()).toStrictEqual(["api", "core"]);
        expect(result.ignoredFiles).toStrictEqual(["README.md"]);
    });

    it("should keep treating an unowned root file as a global change", async () => {
        expect.assertions(1);

        const result = await getAffectedProjects({
            additionalChangedFiles: ["constructor"],
            base: "HEAD",
            fileOwners: { "Cargo.lock": ["core"] },
            head: "HEAD",
            projectGraph,
            projects,
            workspaceRoot: root,
        });

        expect([...result.affectedProjects].sort()).toStrictEqual(["api", "core"]);
    });
});
