import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import type { ProjectGraph, WorkspaceConfiguration } from "@visulima/task-runner";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DOCKER_MANIFEST_FILENAME, pruneDockerContext, resolveFocusProjects, scaffoldDockerContext } from "../../src/util/docker";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

describe(resolveFocusProjects, () => {
    it("should include focus project and all transitive dependencies", () => {
        expect.assertions(4);

        const graph: ProjectGraph = {
            dependencies: {
                A: [{ source: "A", target: "B", type: "static" }],
                B: [{ source: "B", target: "C", type: "static" }],
                C: [],
            },
            nodes: {},
        };

        const result = resolveFocusProjects(["A"], graph);

        expect(result.size).toBe(3);
        expect(result.has("A")).toBe(true);
        expect(result.has("B")).toBe(true);
        expect(result.has("C")).toBe(true);
    });

    it("should return only the focus project when it has no dependencies", () => {
        expect.assertions(2);

        const graph: ProjectGraph = {
            dependencies: {
                A: [{ source: "A", target: "B", type: "static" }],
                B: [{ source: "B", target: "C", type: "static" }],
                C: [],
            },
            nodes: {},
        };

        const result = resolveFocusProjects(["C"], graph);

        expect(result.size).toBe(1);
        expect(result.has("C")).toBe(true);
    });
});

describe(scaffoldDockerContext, () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = createTemporaryDirectory("vis-docker-scaffold-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(tmpDir);
    });

    it("should scaffold workspace with root manifests and focused project manifests", () => {
        expect.assertions(4);

        const workspaceRoot = join(tmpDir, "repo");

        mkdirSync(workspaceRoot, { recursive: true });
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));
        writeFileSync(join(workspaceRoot, "pnpm-lock.yaml"), "lockfile: '9.0'");

        const projADir = join(workspaceRoot, "packages", "a");
        const projBDir = join(workspaceRoot, "packages", "b");

        mkdirSync(projADir, { recursive: true });
        mkdirSync(projBDir, { recursive: true });
        writeFileSync(join(projADir, "package.json"), JSON.stringify({ name: "a" }));
        writeFileSync(join(projBDir, "package.json"), JSON.stringify({ name: "b" }));

        const outDir = join(tmpDir, "out");

        const workspace: WorkspaceConfiguration = {
            projects: {
                a: { root: "packages/a" },
                b: { root: "packages/b" },
            },
        };

        const graph: ProjectGraph = {
            dependencies: {
                a: [{ source: "a", target: "b", type: "static" }],
                b: [],
            },
            nodes: {},
        };

        scaffoldDockerContext({
            focus: ["a"],
            outDir,
            projectGraph: graph,
            workspace,
            workspaceRoot,
        });

        const wsDir = join(outDir, "workspace");

        expect(existsSync(join(wsDir, "package.json"))).toBe(true);
        expect(existsSync(join(wsDir, "packages", "a", "package.json"))).toBe(true);
        expect(existsSync(join(wsDir, "packages", "b", "package.json"))).toBe(true);
        expect(existsSync(join(outDir, DOCKER_MANIFEST_FILENAME))).toBe(true);
    });

    it("should write vis-docker-manifest.json with correct contents", () => {
        expect.assertions(2);

        const workspaceRoot = join(tmpDir, "repo");

        mkdirSync(workspaceRoot, { recursive: true });
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

        const projADir = join(workspaceRoot, "packages", "a");

        mkdirSync(projADir, { recursive: true });
        writeFileSync(join(projADir, "package.json"), JSON.stringify({ name: "a" }));

        const outDir = join(tmpDir, "out");

        const workspace: WorkspaceConfiguration = {
            projects: {
                a: { root: "packages/a" },
            },
        };

        const graph: ProjectGraph = {
            dependencies: {
                a: [],
            },
            nodes: {},
        };

        scaffoldDockerContext({
            focus: ["a"],
            outDir,
            projectGraph: graph,
            workspace,
            workspaceRoot,
        });

        const manifest = JSON.parse(readFileSync(join(outDir, DOCKER_MANIFEST_FILENAME), "utf8"));

        expect(manifest.focus).toStrictEqual(["a"]);
        expect(manifest.projects).toStrictEqual(["a"]);
    });
});

describe(pruneDockerContext, () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = createTemporaryDirectory("vis-docker-prune-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(tmpDir);
    });

    it("should remove unfocused project directories", () => {
        expect.assertions(3);

        const workspaceRoot = join(tmpDir, "repo");
        const contextRoot = join(tmpDir, "ctx");

        mkdirSync(contextRoot, { recursive: true });

        writeFileSync(join(contextRoot, DOCKER_MANIFEST_FILENAME), JSON.stringify({ focus: ["a"], projects: ["a", "b"] }));

        const projADir = join(workspaceRoot, "packages", "a");
        const projBDir = join(workspaceRoot, "packages", "b");
        const projCDir = join(workspaceRoot, "packages", "c");

        mkdirSync(projADir, { recursive: true });
        mkdirSync(projBDir, { recursive: true });
        mkdirSync(projCDir, { recursive: true });
        writeFileSync(join(projADir, "package.json"), "{}");
        writeFileSync(join(projBDir, "package.json"), "{}");
        writeFileSync(join(projCDir, "package.json"), "{}");

        const workspace: WorkspaceConfiguration = {
            projects: {
                a: { root: "packages/a" },
                b: { root: "packages/b" },
                c: { root: "packages/c" },
            },
        };

        const { removed } = pruneDockerContext({ contextRoot, workspace, workspaceRoot });

        expect(removed).toContain("packages/c");
        expect(existsSync(projADir)).toBe(true);
        expect(existsSync(projCDir)).toBe(false);
    });
});
