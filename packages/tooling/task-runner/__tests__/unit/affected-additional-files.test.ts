import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getAffectedProjects } from "../../src/affected";
import type { ProjectConfiguration, ProjectGraph } from "../../src/types";

const projects: Record<string, ProjectConfiguration> = {
    api: { root: "packages/api" },
    web: { root: "packages/web" },
};

// `web` depends on `api`, so a change to api reaches web downstream.
const projectGraph: ProjectGraph = {
    dependencies: {
        api: [],
        web: [{ source: "web", target: "api", type: "static" }],
    },
    nodes: {
        api: { data: { root: "packages/api" }, name: "api", type: "library" },
        web: { data: { root: "packages/web" }, name: "web", type: "application" },
    },
};

const git = (cwd: string, ...arguments_: string[]): void => {
    execFileSync("git", arguments_, { cwd, stdio: "pipe" });
};

describe("getAffectedProjects additionalChangedFiles", () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "tr-affected-"));

        git(root, "init", "--initial-branch=main");
        git(root, "config", "user.email", "test@example.com");
        git(root, "config", "user.name", "Test");

        for (const project of Object.values(projects)) {
            mkdirSync(join(root, project.root, "src"), { recursive: true });
            writeFileSync(join(root, project.root, "src", "index.ts"), "export const a = 1;\n");
        }

        git(root, "add", ".");
        git(root, "commit", "-m", "initial");
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("should report nothing affected when the diff is empty and no extra files are supplied", async () => {
        expect.assertions(2);

        const result = await getAffectedProjects({ base: "HEAD", head: "HEAD", projectGraph, projects, workspaceRoot: root });

        expect(result.changedFiles).toStrictEqual([]);
        expect(result.affectedProjects).toStrictEqual([]);
    });

    it("should map an extra changed file to its project when the git diff is empty", async () => {
        expect.assertions(2);

        // This is the uncommitted working tree case: git sees no committed
        // change, but the file the user just edited must still count.
        const result = await getAffectedProjects({
            additionalChangedFiles: ["packages/api/src/index.ts"],
            base: "HEAD",
            head: "HEAD",
            projectGraph,
            projects,
            workspaceRoot: root,
        });

        expect(result.changedFiles).toStrictEqual(["packages/api/src/index.ts"]);
        expect(result.changedProjects).toStrictEqual(["api"]);
    });

    it("should expand extra changed files through the dependency graph", async () => {
        expect.assertions(1);

        const result = await getAffectedProjects({
            additionalChangedFiles: ["packages/api/src/index.ts"],
            base: "HEAD",
            downstream: "deep",
            head: "HEAD",
            projectGraph,
            projects,
            workspaceRoot: root,
        });

        expect([...result.affectedProjects].sort()).toStrictEqual(["api", "web"]);
    });

    it("should dedupe a path present in both the diff and the extra list", async () => {
        expect.assertions(1);

        writeFileSync(join(root, "packages/api/src/index.ts"), "export const a = 2;\n");
        git(root, "add", ".");
        git(root, "commit", "-m", "change api");

        const result = await getAffectedProjects({
            additionalChangedFiles: ["packages/api/src/index.ts"],
            base: "HEAD~1",
            head: "HEAD",
            projectGraph,
            projects,
            workspaceRoot: root,
        });

        expect(result.changedFiles).toStrictEqual(["packages/api/src/index.ts"]);
    });

    it("should treat an extra file outside every project as a global change", async () => {
        expect.assertions(1);

        // Same rule the diff path uses — a root-level file affects everything.
        const result = await getAffectedProjects({
            additionalChangedFiles: ["tsconfig.json"],
            base: "HEAD",
            head: "HEAD",
            projectGraph,
            projects,
            workspaceRoot: root,
        });

        expect([...result.affectedProjects].sort()).toStrictEqual(["api", "web"]);
    });

    it("should ignore an empty extra list", async () => {
        expect.assertions(1);

        const result = await getAffectedProjects({
            additionalChangedFiles: [],
            base: "HEAD",
            head: "HEAD",
            projectGraph,
            projects,
            workspaceRoot: root,
        });

        expect(result.changedFiles).toStrictEqual([]);
    });
});
