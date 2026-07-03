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

    it("prunes pnpm-lock.yaml down to the focus closure", () => {
        expect.assertions(3);

        const workspaceRoot = join(tmpDir, "repo");

        mkdirSync(workspaceRoot, { recursive: true });
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));
        writeFileSync(
            join(workspaceRoot, "pnpm-lock.yaml"),
            `lockfileVersion: '9.0'
importers:
  .: {}
  packages/a:
    dependencies:
      lodash:
        specifier: ^4.17.21
        version: 4.17.21
  packages/b:
    dependencies:
      chalk:
        specifier: ^5.3.0
        version: 5.3.0
packages:
  lodash@4.17.21:
    resolution: {integrity: sha512-fake}
  chalk@5.3.0:
    resolution: {integrity: sha512-fake}
snapshots:
  lodash@4.17.21: {}
  chalk@5.3.0: {}
`,
        );

        const projectADir = join(workspaceRoot, "packages", "a");
        const projectBDir = join(workspaceRoot, "packages", "b");

        mkdirSync(projectADir, { recursive: true });
        mkdirSync(projectBDir, { recursive: true });
        writeFileSync(join(projectADir, "package.json"), JSON.stringify({ dependencies: { lodash: "^4.17.21" }, name: "a" }));
        writeFileSync(join(projectBDir, "package.json"), JSON.stringify({ dependencies: { chalk: "^5.3.0" }, name: "b" }));

        const outDir = join(tmpDir, "out");
        const messages: string[] = [];

        scaffoldDockerContext({
            focus: ["a"],
            log: (message) => messages.push(message),
            outDir,
            projectGraph: { dependencies: { a: [], b: [] }, nodes: {} },
            workspace: { projects: { a: { root: "packages/a" }, b: { root: "packages/b" } } },
            workspaceRoot,
        });

        const pruned = readFileSync(join(outDir, "workspace", "pnpm-lock.yaml"), "utf8");

        expect(pruned).toContain("lodash@4.17.21");
        expect(pruned).not.toContain("chalk@5.3.0");
        expect(messages.some((m) => m.startsWith("pnpm-lock.yaml:"))).toBe(true);
    });

    it("copies the lockfile verbatim when pruneLockfile is false", () => {
        expect.assertions(1);

        const workspaceRoot = join(tmpDir, "repo");
        const verbatim
            = "lockfileVersion: '9.0'\nimporters:\n  .: {}\n  packages/b:\n    dependencies:\n      chalk:\n        specifier: ^5.3.0\n        version: 5.3.0\n";

        mkdirSync(workspaceRoot, { recursive: true });
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));
        writeFileSync(join(workspaceRoot, "pnpm-lock.yaml"), verbatim);

        mkdirSync(join(workspaceRoot, "packages", "a"), { recursive: true });
        writeFileSync(join(workspaceRoot, "packages", "a", "package.json"), JSON.stringify({ name: "a" }));

        const outDir = join(tmpDir, "out");

        scaffoldDockerContext({
            focus: ["a"],
            log: () => {},
            outDir,
            projectGraph: { dependencies: { a: [] }, nodes: {} },
            pruneLockfile: false,
            workspace: { projects: { a: { root: "packages/a" } } },
            workspaceRoot,
        });

        expect(readFileSync(join(outDir, "workspace", "pnpm-lock.yaml"), "utf8")).toBe(verbatim);
    });

    it("falls back to verbatim copy when the lockfile is unparseable", () => {
        expect.assertions(2);

        const workspaceRoot = join(tmpDir, "repo");
        // Invalid JSON breaks the npm pruner — the scaffold must keep going,
        // log a warning, and copy the original file so the Docker build
        // still has *something* to install from.
        const broken = "{ this is not json";

        mkdirSync(workspaceRoot, { recursive: true });
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));
        writeFileSync(join(workspaceRoot, "package-lock.json"), broken);

        mkdirSync(join(workspaceRoot, "packages", "a"), { recursive: true });
        writeFileSync(join(workspaceRoot, "packages", "a", "package.json"), JSON.stringify({ name: "a" }));

        const outDir = join(tmpDir, "out");
        const messages: string[] = [];

        scaffoldDockerContext({
            focus: ["a"],
            log: (message) => messages.push(message),
            outDir,
            projectGraph: { dependencies: { a: [] }, nodes: {} },
            workspace: { projects: { a: { root: "packages/a" } } },
            workspaceRoot,
        });

        expect(readFileSync(join(outDir, "workspace", "package-lock.json"), "utf8")).toBe(broken);
        expect(messages.some((m) => m.includes("pruning failed") && m.includes("copying verbatim"))).toBe(true);
    });

    it("ships npm-shrinkwrap.json into the Docker context (not silently dropped)", () => {
        expect.assertions(3);

        const workspaceRoot = join(tmpDir, "repo");

        mkdirSync(workspaceRoot, { recursive: true });
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root", workspaces: ["packages/a"] }));
        // npm-shrinkwrap.json shares the package-lock format; before the fix
        // it wasn't in LOCKFILE_FILES, so a shrinkwrap-only project shipped
        // no lockfile at all and the in-container `npm ci` had nothing to
        // install from.
        writeFileSync(
            join(workspaceRoot, "npm-shrinkwrap.json"),
            JSON.stringify({
                lockfileVersion: 3,
                name: "root",
                packages: {
                    "": { name: "root", workspaces: ["packages/a"] },
                    "node_modules/lodash": { resolved: "https://r/lodash", version: "4.17.21" },
                    "packages/a": { dependencies: { lodash: "^4.17.21" }, name: "a", version: "0.0.0" },
                },
            }),
        );

        mkdirSync(join(workspaceRoot, "packages", "a"), { recursive: true });
        writeFileSync(join(workspaceRoot, "packages", "a", "package.json"), JSON.stringify({ dependencies: { lodash: "^4.17.21" }, name: "a" }));

        const outDir = join(tmpDir, "out");
        const messages: string[] = [];

        scaffoldDockerContext({
            focus: ["a"],
            log: (message) => messages.push(message),
            outDir,
            projectGraph: { dependencies: { a: [] }, nodes: {} },
            workspace: { projects: { a: { root: "packages/a" } } },
            workspaceRoot,
        });

        // Written back under the discovered filename, routed through the npm
        // pruner (valid JSON with the focus closure retained proves it was
        // pruned, not skipped/verbatim), and the log message names the file
        // the user actually has — not a hardcoded "package-lock.json".
        const out = join(outDir, "workspace", "npm-shrinkwrap.json");

        expect(existsSync(out)).toBe(true);

        const parsed = JSON.parse(readFileSync(out, "utf8")) as { packages?: Record<string, unknown> };

        expect(parsed.packages?.["node_modules/lodash"]).toBeDefined();
        expect(messages.some((m) => m.startsWith("npm-shrinkwrap.json:"))).toBe(true);
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
