import { strip } from "@visulima/colorize";
import type { Task, TaskResult } from "@visulima/task-runner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StaticOutputLifeCycle } from "../../src/tui/static-life-cycle";

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

describe("tui/StaticOutputLifeCycle", () => {
    let writeSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        writeSpy.mockRestore();
    });

    const createLifeCycle = (tasks: Task[], targets: string[] = ["build"]): StaticOutputLifeCycle => {
        const projectNames = [...new Set(tasks.map((t) => t.target.project))];

        return new StaticOutputLifeCycle({
            args: { targets },
            projectNames,
            tasks,
        });
    };

    it("should print header on startCommand", () => {
        const tasks = [createTask("app-a", "build")];
        const lc = createLifeCycle(tasks);

        lc.startCommand();

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("VIS");
        expect(allOutput).toContain("Running");
    });

    it("should print task IDs on startTasks", () => {
        const tasks = [createTask("app-a", "build"), createTask("app-b", "build")];
        const lc = createLifeCycle(tasks);

        lc.startTasks(tasks);

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("app-a:build");
        expect(allOutput).toContain("app-b:build");
    });

    it("should print results with status icons on endTasks", () => {
        const task = createTask("app-a", "build");
        const lc = createLifeCycle([task]);

        lc.endTasks([createResult(task, "success")]);

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("app-a:build");
    });

    it("should show [cache] label for cached tasks", () => {
        const task = createTask("app-a", "build");
        const lc = createLifeCycle([task]);

        lc.endTasks([createResult(task, "local-cache")]);

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("[cache]");
    });

    it("should print success summary when all tasks pass", () => {
        const task = createTask("app-a", "build");
        const lc = createLifeCycle([task]);

        lc.startCommand();
        writeSpy.mockClear();

        lc.endTasks([createResult(task, "success")]);
        lc.endCommand();

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("Successfully ran");
        expect(allOutput).toContain("1 tasks completed");
    });

    it("should print cache statistics in success summary", () => {
        const tasks = [createTask("app-a", "build"), createTask("app-b", "build")];
        const lc = createLifeCycle(tasks);

        lc.startCommand();
        writeSpy.mockClear();

        lc.endTasks([createResult(tasks[0]!, "success"), createResult(tasks[1]!, "local-cache")]);
        lc.endCommand();

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("1 read from cache");
    });

    it("should print failure summary when tasks fail", () => {
        const tasks = [createTask("app-a", "build"), createTask("app-b", "build")];
        const lc = createLifeCycle(tasks);

        lc.startCommand();
        writeSpy.mockClear();

        lc.endTasks([createResult(tasks[0]!, "success"), createResult(tasks[1]!, "failure")]);
        lc.endCommand();

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("1 task failed");
        expect(allOutput).toContain("app-b:build");
    });

    it("should detect skipped tasks", () => {
        const tasks = [createTask("app-a", "build"), createTask("app-b", "build"), createTask("app-c", "build")];
        const lc = createLifeCycle(tasks);

        lc.startCommand();
        writeSpy.mockClear();

        // Only app-a completes, app-b fails, app-c never runs (skipped)
        lc.endTasks([createResult(tasks[0]!, "success"), createResult(tasks[1]!, "failure")]);
        lc.endCommand();

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("1 task skipped");
        expect(allOutput).toContain("app-c:build");
    });

    it("should forward terminal output via printTaskTerminalOutput", () => {
        const task = createTask("app-a", "build");
        const lc = createLifeCycle([task]);

        lc.printTaskTerminalOutput(task, "failure", "Error: something broke");

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("Error: something broke");
    });
});
