import { describe, it, expect } from "vitest";

import { filterAffectedTasks } from "../src/affected";

describe("filterAffectedTasks", () => {
    it("should filter tasks to only affected projects", () => {
        const taskIds = ["app:build", "lib-a:build", "lib-b:build", "lib-c:build"];
        const affected = new Set(["app", "lib-a"]);

        const filtered = filterAffectedTasks(taskIds, affected);

        expect(filtered).toEqual(["app:build", "lib-a:build"]);
    });

    it("should return empty when no tasks are affected", () => {
        const taskIds = ["lib-c:build"];
        const affected = new Set(["app"]);

        const filtered = filterAffectedTasks(taskIds, affected);

        expect(filtered).toEqual([]);
    });

    it("should return all tasks when all projects are affected", () => {
        const taskIds = ["a:build", "b:test"];
        const affected = new Set(["a", "b"]);

        const filtered = filterAffectedTasks(taskIds, affected);

        expect(filtered).toEqual(["a:build", "b:test"]);
    });
});
