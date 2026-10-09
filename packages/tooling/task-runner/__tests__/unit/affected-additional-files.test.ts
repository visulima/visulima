import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getAffectedProjects } from "../../src/affected";
import type { ProjectConfiguration, ProjectGraph } from "../../src/types";

// When this test file runs inside a git pre-commit hook, git exports
// GIT_DIR / GIT_INDEX_FILE / GIT_WORK_TREE pointing at the hook-running
// repo. The fixture's `git add` / `git commit` would then write the
// commit-in-progress index instead of the temp repo's. Strip them.
for (const key of Object.keys(process.env)) {
    if (key.startsWith("GIT_")) {
        Reflect.deleteProperty(process.env, key);
    }
}

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

    describe("ignoredFiles", () => {
        const run = (changed: string[], ignoredFiles: string[]) =>
            getAffectedProjects({ additionalChangedFiles: changed, base: "HEAD", head: "HEAD", ignoredFiles, projectGraph, projects, workspaceRoot: root });

        it("should skip an unowned file matching a pattern instead of marking everything", async () => {
            expect.assertions(3);

            const result = await run(["api-snapshots/testing.api.md", "packages/api/src/index.ts"], ["api-snapshots/**"]);

            expect([...result.affectedProjects].sort()).toStrictEqual(["api", "web"]);
            expect(result.changedProjects).toStrictEqual(["api"]);
            expect(result.ignoredFiles).toStrictEqual(["api-snapshots/testing.api.md"]);
        });

        it("should report nothing affected when every change is ignored", async () => {
            expect.assertions(3);

            const result = await run(["api-snapshots/testing.api.md"], ["api-snapshots/**"]);

            expect(result.affectedProjects).toStrictEqual([]);
            // The full diff is still reported; only the mapping skips it.
            expect(result.changedFiles).toStrictEqual(["api-snapshots/testing.api.md"]);
            expect(result.ignoredFiles).toStrictEqual(["api-snapshots/testing.api.md"]);
        });

        it("should still mark everything for an unowned file that matches no pattern", async () => {
            expect.assertions(2);

            const result = await run(["api-snapshots/testing.api.md", "tsconfig.json"], ["api-snapshots/**"]);

            expect([...result.affectedProjects].sort()).toStrictEqual(["api", "web"]);
            // Every file is still classified, regardless of order.
            expect(result.ignoredFiles).toStrictEqual(["api-snapshots/testing.api.md"]);
        });

        it("should never filter a file inside a project, even when a pattern matches it", async () => {
            expect.assertions(3);

            const result = await run(["packages/api/README.md"], ["**/*.md"]);

            expect(result.changedProjects).toStrictEqual(["api"]);
            expect([...result.affectedProjects].sort()).toStrictEqual(["api", "web"]);
            expect(result.ignoredFiles).toStrictEqual([]);
        });

        it("should match a root-level *.md pattern only at the root, not in a nested folder", async () => {
            expect.assertions(4);

            const rootLevel = await run(["README.md"], ["*.md"]);

            expect(rootLevel.affectedProjects).toStrictEqual([]);
            expect(rootLevel.ignoredFiles).toStrictEqual(["README.md"]);

            // `*` does not cross `/`, so docs/x.md is unowned and unmatched.
            const nested = await run(["docs/x.md"], ["*.md"]);

            expect([...nested.affectedProjects].sort()).toStrictEqual(["api", "web"]);
            expect(nested.ignoredFiles).toStrictEqual([]);
        });
    });
});
