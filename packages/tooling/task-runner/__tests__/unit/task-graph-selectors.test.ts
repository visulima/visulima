import { describe, expect, it } from "vitest";

import { createTaskGraph } from "../../src/task-graph";
import type { ProjectGraph, Task, WorkspaceConfiguration } from "../../src/types";

describe("dependsOn.projects selectors", () => {
    const makeWorkspace = (dependsOn: unknown[]): WorkspaceConfiguration =>
        ({
            projects: {
                "@scope/one": { root: "packages/one", targets: { lint: { command: "eslint ." } } },
                "@scope/two": { root: "packages/two", targets: { lint: { command: "eslint ." } } },
                app: { root: "apps/app", targets: { check: { command: "true", dependsOn } } },
                other: { root: "packages/other", targets: { lint: { command: "eslint ." } } },
            },
        }) as unknown as WorkspaceConfiguration;

    const projectGraph = {
        dependencies: { "@scope/one": [], "@scope/two": [], app: [], other: [] },
        nodes: {},
    } as unknown as ProjectGraph;

    const checkTask: Task = {
        id: "app:check",
        outputs: [],
        overrides: {},
        projectRoot: "apps/app",
        target: { project: "app", target: "check" },
    };

    it("expands a scope glob to every matching project", () => {
        expect.assertions(3);

        const graph = createTaskGraph([checkTask], {
            projectGraph,
            workspace: makeWorkspace([{ projects: ["@scope/*"], target: "lint" }]),
        });

        expect(Object.keys(graph.tasks)).toContain("@scope/one:lint");
        expect(Object.keys(graph.tasks)).toContain("@scope/two:lint");
        expect(Object.keys(graph.tasks)).not.toContain("other:lint");
    });

    it("expands `*` to every project that declares the target", () => {
        expect.assertions(2);

        const graph = createTaskGraph([checkTask], {
            projectGraph,
            workspace: makeWorkspace([{ projects: ["*"], target: "lint" }]),
        });

        expect(Object.keys(graph.tasks)).toContain("@scope/one:lint");
        expect(Object.keys(graph.tasks)).toContain("other:lint");
    });

    it("does not build a self-edge when a glob includes the declaring project", () => {
        expect.assertions(2);

        // "after everyone else's check" is a natural thing to write, but the
        // glob necessarily matches the declaring project too. That edge is
        // hard, so the soft-cycle breaker leaves it and the orchestrator
        // deadlocks on a cycle of one.
        const graph = createTaskGraph([checkTask], {
            projectGraph,
            workspace: makeWorkspace([{ projects: ["*"], target: "check" }]),
        });

        expect(graph.dependencies["app:check"]).not.toContain("app:check");
        expect(graph.dependencies["app:check"]).toStrictEqual([]);
    });

    it("keeps matching an exact project name", () => {
        expect.assertions(2);

        const graph = createTaskGraph([checkTask], {
            projectGraph,
            workspace: makeWorkspace([{ projects: ["other"], target: "lint" }]),
        });

        expect(Object.keys(graph.tasks)).toContain("other:lint");
        expect(Object.keys(graph.tasks)).not.toContain("@scope/one:lint");
    });

    it("treats an Object.prototype member name as unmatched, not as an exact project", () => {
        expect.assertions(2);

        // A bare `projects[selector]` lookup resolves through the prototype,
        // so "constructor" was accepted as an exact project name: no task, and
        // no warning either.
        const unmatched: string[] = [];
        const graph = createTaskGraph([checkTask], {
            onUnmatchedProjectSelector: (selector) => unmatched.push(selector),
            projectGraph,
            workspace: makeWorkspace([{ projects: ["constructor"], target: "lint" }]),
        });

        expect(unmatched).toStrictEqual(["constructor"]);
        expect(Object.keys(graph.tasks)).toStrictEqual(["app:check"]);
    });

    it("reports a selector that matched nothing instead of silently dropping the edge", () => {
        expect.assertions(2);

        const unmatched: string[] = [];
        const graph = createTaskGraph([checkTask], {
            onUnmatchedProjectSelector: (selector) => unmatched.push(selector),
            projectGraph,
            workspace: makeWorkspace([{ projects: ["@nope/*"], target: "lint" }]),
        });

        expect(unmatched).toStrictEqual(["@nope/*"]);
        expect(Object.keys(graph.tasks)).toStrictEqual(["app:check"]);
    });
});

describe("targetDefaults are defaults, not declarations", () => {
    const workspace = {
        projects: {
            withBuild: { root: "packages/with-build", targets: { build: { command: "tsc" } } },
        },
    } as unknown as WorkspaceConfiguration;

    const projectGraph = { dependencies: { withBuild: [] }, nodes: {} } as unknown as ProjectGraph;

    const buildTask: Task = {
        id: "withBuild:build",
        outputs: [],
        overrides: {},
        projectRoot: "packages/with-build",
        target: { project: "withBuild", target: "build" },
    };

    it("does not create a task for a settings-only default", () => {
        expect.assertions(1);

        // A root `tasks: { "lint:types": { cache: true } }` used to give every
        // project that target, producing a commandless task that printed
        // "No command configured" and was still counted as a success — so the
        // run summary's task count stopped matching reality.
        const graph = createTaskGraph([buildTask], {
            projectGraph,
            targetDefaults: { build: { dependsOn: ["lint:types"] }, "lint:types": { cache: true } },
            workspace,
        });

        expect(Object.keys(graph.tasks)).toStrictEqual(["withBuild:build"]);
    });

    it("still creates the task when the default supplies a runnable command", () => {
        expect.assertions(1);

        const graph = createTaskGraph([buildTask], {
            projectGraph,
            targetDefaults: { build: { dependsOn: ["verify"] }, verify: { command: "true" } },
            workspace,
        });

        expect(Object.keys(graph.tasks)).toContain("withBuild:verify");
    });
});
