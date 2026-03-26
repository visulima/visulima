import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { strip } from "@visulima/colorize";

import type { Task, TaskResult } from "@visulima/task-runner";

import { createDynamicOutputRenderer } from "../../src/tui/dynamic-life-cycle";

const createTask = (project: string, target: string): Task => ({
    id: `${project}:${target}`,
    outputs: [],
    overrides: {},
    target: { project, target },
});

const createResult = (
    task: Task,
    status: "success" | "failure" | "local-cache" = "success",
): TaskResult => ({
    code: status === "failure" ? 1 : 0,
    endTime: 2000,
    startTime: 1000,
    status,
    task,
    terminalOutput: `output for ${task.id}`,
});

describe("tui/createDynamicOutputRenderer", () => {
    let writeSpy: ReturnType<typeof vi.spyOn>;
    let sigintListeners: Array<(...args: unknown[]) => void>;
    let sigtermListeners: Array<(...args: unknown[]) => void>;

    beforeEach(() => {
        writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
        sigintListeners = [];
        sigtermListeners = [];

        vi.spyOn(process, "on").mockImplementation((event: string, listener: (...args: unknown[]) => void) => {
            if (event === "SIGINT") {
                sigintListeners.push(listener);
            }

            if (event === "SIGTERM") {
                sigtermListeners.push(listener);
            }

            return process;
        });

        vi.spyOn(process, "removeListener").mockImplementation(() => process);

        // Mock process.stdout.columns for separator width
        Object.defineProperty(process.stdout, "columns", { configurable: true, value: 80 });
    });

    afterEach(() => {
        writeSpy.mockRestore();
        vi.restoreAllMocks();
    });

    const createRenderer = (tasks: Task[]) => {
        const projectNames = [...new Set(tasks.map((t) => t.target.project))];

        return createDynamicOutputRenderer({
            args: { parallel: 3, targets: ["build"] },
            projectNames,
            tasks,
        });
    };

    it("should return a lifeCycle and renderIsDone promise", () => {
        const tasks = [createTask("app-a", "build")];
        const result = createRenderer(tasks);

        expect(result.lifeCycle).toBeDefined();
        expect(result.renderIsDone).toBeInstanceOf(Promise);
    });

    it("should write header with cursor hide on startCommand", () => {
        const tasks = [createTask("app-a", "build")];
        const { lifeCycle } = createRenderer(tasks);

        lifeCycle.startCommand!();

        const allOutput = writeSpy.mock.calls.map((c) => String(c[0])).join("");

        // Should contain cursor hide sequence (ESC[?25l)
        expect(allOutput).toContain("\u001B[?25l");
        expect(strip(allOutput)).toContain("VIS");
        expect(strip(allOutput)).toContain("Running");
    });

    it("should register signal handlers on startCommand", () => {
        const tasks = [createTask("app-a", "build")];
        const { lifeCycle } = createRenderer(tasks);

        lifeCycle.startCommand!();

        expect(sigintListeners.length).toBeGreaterThan(0);
        expect(sigtermListeners.length).toBeGreaterThan(0);
    });

    it("should mark tasks as running on startTasks", () => {
        vi.useFakeTimers();

        const tasks = [createTask("app-a", "build")];
        const { lifeCycle } = createRenderer(tasks);

        lifeCycle.startCommand!();
        writeSpy.mockClear();

        lifeCycle.startTasks!(tasks);

        // Advance timer to trigger a render
        vi.advanceTimersByTime(100);

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("app-a:build");

        // Clean up: end the command to clear interval
        lifeCycle.endCommand!();
        vi.useRealTimers();
    });

    it("should track completed tasks on endTasks", () => {
        const tasks = [createTask("app-a", "build"), createTask("app-b", "build")];
        const { lifeCycle } = createRenderer(tasks);

        lifeCycle.startCommand!();
        lifeCycle.startTasks!(tasks);
        writeSpy.mockClear();

        lifeCycle.endTasks!([createResult(tasks[0]!, "success")]);

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("app-a:build");

        lifeCycle.endCommand!();
    });

    it("should show [cache] for cached tasks", () => {
        const tasks = [createTask("app-a", "build")];
        const { lifeCycle } = createRenderer(tasks);

        lifeCycle.startCommand!();
        lifeCycle.startTasks!(tasks);
        writeSpy.mockClear();

        lifeCycle.endTasks!([createResult(tasks[0]!, "local-cache")]);

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("[cache]");

        lifeCycle.endCommand!();
    });

    it("should print success summary on endCommand when all tasks pass", () => {
        const tasks = [createTask("app-a", "build")];
        const { lifeCycle } = createRenderer(tasks);

        lifeCycle.startCommand!();
        lifeCycle.startTasks!(tasks);
        lifeCycle.endTasks!([createResult(tasks[0]!, "success")]);
        writeSpy.mockClear();

        lifeCycle.endCommand!();

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("Successfully ran");
        // Should restore cursor (ESC[?25h)
        const rawOutput = writeSpy.mock.calls.map((c) => String(c[0])).join("");

        expect(rawOutput).toContain("\u001B[?25h");
    });

    it("should print error summary on endCommand when tasks fail", () => {
        const tasks = [createTask("app-a", "build"), createTask("app-b", "build")];
        const { lifeCycle } = createRenderer(tasks);

        lifeCycle.startCommand!();
        lifeCycle.startTasks!(tasks);
        lifeCycle.endTasks!([createResult(tasks[0]!, "success"), createResult(tasks[1]!, "failure")]);
        writeSpy.mockClear();

        lifeCycle.endCommand!();

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("1 task failed");
        expect(allOutput).toContain("app-b:build");
    });

    it("should resolve renderIsDone after endCommand", async () => {
        const tasks = [createTask("app-a", "build")];
        const { lifeCycle, renderIsDone } = createRenderer(tasks);

        lifeCycle.startCommand!();
        lifeCycle.startTasks!(tasks);
        lifeCycle.endTasks!([createResult(tasks[0]!, "success")]);
        lifeCycle.endCommand!();

        // renderIsDone should resolve
        await expect(renderIsDone).resolves.toBeUndefined();
    });

    it("should remove signal handlers on endCommand", () => {
        const tasks = [createTask("app-a", "build")];
        const { lifeCycle } = createRenderer(tasks);

        lifeCycle.startCommand!();
        lifeCycle.startTasks!(tasks);
        lifeCycle.endTasks!([createResult(tasks[0]!, "success")]);
        lifeCycle.endCommand!();

        expect(process.removeListener).toHaveBeenCalledWith("SIGINT", expect.any(Function));
        expect(process.removeListener).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    });

    it("should print failure output inline for failed tasks", () => {
        const tasks = [createTask("app-a", "build")];
        const { lifeCycle } = createRenderer(tasks);

        lifeCycle.startCommand!();
        lifeCycle.startTasks!(tasks);
        writeSpy.mockClear();

        lifeCycle.printTaskTerminalOutput!(tasks[0]!, "failure", "Error: compilation failed");

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("Error: compilation failed");

        lifeCycle.endCommand!();
    });
});
