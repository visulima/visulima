import { describe, expect, it } from "vitest";

import { splitCompoundTasks } from "../../src/split-compound-tasks";
import type { Task, TaskGraph } from "../../src/types";

const task = (id: string, command: string, overrides: Partial<Task> = {}): Task => {
    return {
        id,
        outputs: [],
        overrides: { command },
        splitCompound: true,
        target: { project: id.split(":")[0]!, target: id.split(":")[1]! },
        ...overrides,
    };
};

const commandOf = (candidate: Task): string | undefined => candidate.overrides["command"] as string | undefined;

describe(splitCompoundTasks, () => {
    it("chains segments, moves dependencies to the first segment and dependents to the last", () => {
        expect.assertions(4);

        const graph: TaskGraph = {
            dependencies: {
                "app:build": ["lib:build"],
                "app:test": ["app:build"],
                "lib:build": [],
            },
            roots: ["app:test"],
            tasks: {
                "app:build": task("app:build", "a && b && c"),
                "app:test": { ...task("app:test", "t"), splitCompound: undefined },
                "lib:build": { ...task("lib:build", "l"), splitCompound: undefined },
            },
        };

        const split = splitCompoundTasks(graph, { commandOf });

        expect(split.dependencies["app:build#1"]).toStrictEqual(["lib:build"]);
        expect(split.dependencies["app:build#2"]).toStrictEqual(["app:build#1"]);
        expect(split.dependencies["app:build#3"]).toStrictEqual(["app:build#2"]);
        expect(split.dependencies["app:test"]).toStrictEqual(["app:build#3"]);
    });

    it("does not mutate the input graph and is a no-op the second time", () => {
        expect.assertions(3);

        const graph: TaskGraph = {
            dependencies: { "app:build": [] },
            roots: ["app:build"],
            tasks: { "app:build": task("app:build", "a && b") },
        };

        const split = splitCompoundTasks(graph, { commandOf });

        expect(graph.tasks["app:build"]?.splitCompound).toBe(true);
        expect(Object.keys(split.tasks)).toStrictEqual(["app:build#1", "app:build#2"]);
        expect(splitCompoundTasks(split, { commandOf })).toBe(split);
    });

    it("attaches declared outputs to the last segment only", () => {
        expect.assertions(2);

        const graph: TaskGraph = {
            dependencies: { "app:build": [] },
            roots: ["app:build"],
            tasks: { "app:build": task("app:build", "a && b", { outputs: ["dist/**"] }) },
        };

        const split = splitCompoundTasks(graph, { commandOf });

        expect(split.tasks["app:build#1"]?.outputs).toStrictEqual([]);
        expect(split.tasks["app:build#2"]?.outputs).toStrictEqual(["dist/**"]);
    });

    it("refuses {auto: true} outputs and clears the flag with one diagnostic", () => {
        expect.assertions(3);

        const diagnostics: [string, string][] = [];
        const graph: TaskGraph = {
            dependencies: { "app:build": [] },
            roots: ["app:build"],
            tasks: { "app:build": task("app:build", "a && b", { outputs: [{ auto: true }] }) },
        };

        const split = splitCompoundTasks(graph, { commandOf, onDiagnostic: (id, message) => diagnostics.push([id, message]) });

        expect(Object.keys(split.tasks)).toStrictEqual(["app:build"]);
        expect(split.tasks["app:build"]?.splitCompound).toBeUndefined();
        expect(diagnostics).toHaveLength(1);
    });

    it("refuses a when condition, with one diagnostic, and clears the flag", () => {
        expect.assertions(3);

        const diagnostics: string[] = [];
        const graph: TaskGraph = {
            dependencies: { "app:build": [] },
            roots: ["app:build"],
            tasks: { "app:build": task("app:build", "a && b", { when: { branch: "main" } }) },
        };

        const split = splitCompoundTasks(graph, { commandOf, onDiagnostic: (_id, message) => diagnostics.push(message) });

        expect(Object.keys(split.tasks)).toStrictEqual(["app:build"]);
        expect(split.tasks["app:build"]?.splitCompound).toBeUndefined();
        expect(diagnostics).toStrictEqual([expect.stringContaining("a when condition")]);
    });

    it("refuses an always target, with one diagnostic, and clears the flag", () => {
        expect.assertions(3);

        const diagnostics: string[] = [];
        const graph: TaskGraph = {
            dependencies: { "app:build": [] },
            roots: ["app:build"],
            tasks: { "app:build": task("app:build", "a && b", { always: true }) },
        };

        const split = splitCompoundTasks(graph, { commandOf, onDiagnostic: (_id, message) => diagnostics.push(message) });

        expect(Object.keys(split.tasks)).toStrictEqual(["app:build"]);
        expect(split.tasks["app:build"]?.splitCompound).toBeUndefined();
        expect(diagnostics).toStrictEqual([expect.stringContaining("always-run target")]);
    });

    it("refuses a trace-mode target, with one diagnostic, and clears the flag", () => {
        expect.assertions(3);

        const diagnostics: string[] = [];
        const graph: TaskGraph = {
            dependencies: { "app:build": [] },
            roots: ["app:build"],
            tasks: { "app:build": task("app:build", "a && b", { hashMode: "trace" }) },
        };

        const split = splitCompoundTasks(graph, { commandOf, onDiagnostic: (_id, message) => diagnostics.push(message) });

        expect(Object.keys(split.tasks)).toStrictEqual(["app:build"]);
        expect(split.tasks["app:build"]?.splitCompound).toBeUndefined();
        expect(diagnostics).toStrictEqual([expect.stringContaining("traced hashing")]);
    });

    it("refuses every target when global auto-fingerprinting is on, even one declared in declared mode", () => {
        expect.assertions(3);

        const diagnostics: string[] = [];
        const graph: TaskGraph = {
            dependencies: { "app:build": [] },
            roots: ["app:build"],
            tasks: { "app:build": task("app:build", "a && b") },
        };

        const split = splitCompoundTasks(graph, { autoFingerprint: true, commandOf, onDiagnostic: (_id, message) => diagnostics.push(message) });

        expect(Object.keys(split.tasks)).toStrictEqual(["app:build"]);
        expect(split.tasks["app:build"]?.splitCompound).toBeUndefined();
        expect(diagnostics).toStrictEqual([expect.stringContaining("traced hashing")]);
    });

    it("leaves tasks without the flag untouched", () => {
        expect.assertions(1);

        const plain: Task = { ...task("app:build", "a && b"), splitCompound: undefined };
        const graph: TaskGraph = { dependencies: { "app:build": [] }, roots: ["app:build"], tasks: { "app:build": plain } };

        expect(splitCompoundTasks(graph, { commandOf })).toBe(graph);
    });
});
