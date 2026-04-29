import { describe, expect, it } from "vitest";

import { applyProjectFilter } from "../src/watch-filter";

const task = (project: string, target = "test"): { id: string; target: { project: string; target: string } } => ({
    id: `${project}:${target}`,
    target: { project, target },
});

const baseTasks = [
    task("vis"),
    task("cerebro"),
    task("packem"),
    task("task-runner"),
    task("Pail"),
];

describe(applyProjectFilter, () => {
    it("returns a copy of the base tasks when filter is undefined", () => {
        expect.assertions(3);

        const result = applyProjectFilter(baseTasks, undefined);

        expect(result.filter).toBeUndefined();
        expect(result.tasks).toStrictEqual(baseTasks);
        // Returned array must be a copy so the caller can safely
        // assign it to a mutable slot without aliasing the input.
        expect(result.tasks).not.toBe(baseTasks);
    });

    it("treats empty and whitespace-only filters as no filter", () => {
        expect.assertions(4);

        for (const empty of ["", "   ", "\t", "\n"]) {
            const result = applyProjectFilter(baseTasks, empty);

            expect(result.filter).toBeUndefined();
        }
    });

    it("matches case-insensitively against task.target.project", () => {
        expect.assertions(2);

        const result = applyProjectFilter(baseTasks, "PAIL");

        expect(result.filter).toBe("PAIL");
        expect(result.tasks.map((t) => t.target.project)).toStrictEqual(["Pail"]);
    });

    it("treats the filter as a substring (not exact) match", () => {
        expect.assertions(1);

        const result = applyProjectFilter(baseTasks, "run");

        expect(result.tasks.map((t) => t.target.project)).toStrictEqual(["task-runner"]);
    });

    it("trims surrounding whitespace before matching", () => {
        expect.assertions(2);

        const result = applyProjectFilter(baseTasks, "  cere  ");

        expect(result.filter).toBe("cere");
        expect(result.tasks.map((t) => t.target.project)).toStrictEqual(["cerebro"]);
    });

    it("returns an empty list when nothing matches", () => {
        expect.assertions(2);

        const result = applyProjectFilter(baseTasks, "no-such-project");

        expect(result.filter).toBe("no-such-project");
        expect(result.tasks).toStrictEqual([]);
    });

    it("preserves the order of the base task list", () => {
        expect.assertions(1);

        const result = applyProjectFilter(baseTasks, "a");

        // vis/cerebro lack `a`; packem/task-runner/Pail all contain it
        // and must appear in their original base-list order.
        expect(result.tasks.map((t) => t.target.project)).toStrictEqual(["packem", "task-runner", "Pail"]);
    });
});
