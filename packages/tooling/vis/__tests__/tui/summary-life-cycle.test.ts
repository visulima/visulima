import { strip } from "@visulima/colorize";
import type { Task, TaskResult } from "@visulima/task-runner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SummaryLifeCycle } from "../../src/tui/summary-life-cycle";

const createTask = (project: string, target: string): Task => {
    return {
        id: `${project}:${target}`,
        outputs: [],
        overrides: {},
        target: { project, target },
    };
};

const createResult = (task: Task, status: "success" | "failure" | "local-cache" | "skipped" = "success"): TaskResult => {
    return {
        code: status === "failure" ? 1 : 0,
        endTime: 2000,
        startTime: 1000,
        status,
        task,
        terminalOutput: `output for ${task.id}`,
    };
};

describe("tui/SummaryLifeCycle", () => {
    let writeSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        writeSpy.mockRestore();
    });

    it("should collect tasks from startTasks and endTasks", () => {
        expect.assertions(2);

        const lc = new SummaryLifeCycle();
        const task = createTask("app-a", "build");

        lc.startTasks([task]);
        lc.endTasks([createResult(task, "success")]);
        lc.endCommand();

        const allOutput = (writeSpy.mock.calls as unknown[][]).map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("Task Summary");
        expect(allOutput).toContain("app-a:build");
    });

    it("should show [cache] label for cached tasks", () => {
        expect.assertions(1);

        const lc = new SummaryLifeCycle();
        const task = createTask("app-a", "build");

        lc.startTasks([task]);
        lc.endTasks([createResult(task, "local-cache")]);
        lc.endCommand();

        const allOutput = (writeSpy.mock.calls as unknown[][]).map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("[cache]");
    });

    it("should sort failures first in the summary", () => {
        expect.assertions(2);

        const lc = new SummaryLifeCycle();
        const taskA = createTask("app-a", "build");
        const taskB = createTask("app-b", "build");
        const taskC = createTask("app-c", "build");

        lc.startTasks([taskA, taskB, taskC]);
        lc.endTasks([createResult(taskA, "success"), createResult(taskB, "failure"), createResult(taskC, "local-cache")]);
        lc.endCommand();

        const allOutput = (writeSpy.mock.calls as unknown[][]).map((c) => strip(String(c[0]))).join("");

        // Failure should appear before success and cache
        const failureIndex = allOutput.indexOf("app-b:build");
        const successIndex = allOutput.indexOf("app-a:build");
        const cacheIndex = allOutput.indexOf("app-c:build");

        expect(failureIndex).toBeLessThan(successIndex);
        expect(failureIndex).toBeLessThan(cacheIndex);
    });

    it("should do nothing on endCommand when no tasks were tracked", () => {
        expect.assertions(1);

        const lc = new SummaryLifeCycle();

        lc.endCommand();

        expect(writeSpy).not.toHaveBeenCalled();
    });

    it("should accumulate output via appendTaskOutput", () => {
        expect.assertions(1);

        const lc = new SummaryLifeCycle();
        const task = createTask("app-a", "build");

        lc.startTasks([task]);
        lc.appendTaskOutput("app-a:build", "chunk1");
        lc.appendTaskOutput("app-a:build", "chunk2");
        lc.endTasks([createResult(task, "success")]);
        lc.endCommand();

        // The summary itself only shows task IDs and status, not output
        const allOutput = (writeSpy.mock.calls as unknown[][]).map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("app-a:build");
    });

    it("should collect output via printTaskTerminalOutput", () => {
        expect.assertions(1);

        const lc = new SummaryLifeCycle();
        const task = createTask("app-a", "build");

        lc.startTasks([task]);
        lc.printTaskTerminalOutput(task, "success", "some output");
        lc.endTasks([createResult(task, "success")]);
        lc.endCommand();

        const allOutput = (writeSpy.mock.calls as unknown[][]).map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("app-a:build");
    });

    it("should handle endTasks for tasks not previously seen in startTasks", () => {
        expect.assertions(1);

        const lc = new SummaryLifeCycle();
        const task = createTask("app-a", "build");

        // Directly call endTasks without startTasks
        lc.endTasks([createResult(task, "success")]);
        lc.endCommand();

        const allOutput = (writeSpy.mock.calls as unknown[][]).map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("app-a:build");
    });
});
