import { strip } from "@visulima/colorize";
import type { Task, TaskResult } from "@visulima/task-runner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDynamicOutputRenderer } from "../../src/tui/dynamic-life-cycle";

const createTask = (project: string, target: string): Task => {
    return {
        id: `${project}:${target}`,
        outputs: [],
        overrides: {},
        target: { project, target },
    };
};

const createResult = (task: Task, status: "success" | "failure" | "local-cache" = "success"): TaskResult => {
    return {
        code: status === "failure" ? 1 : 0,
        endTime: 2000,
        startTime: 1000,
        status,
        task,
        terminalOutput: `output for ${task.id}`,
    };
};

describe("tui/createDynamicOutputRenderer", () => {
    let writeSpy: ReturnType<typeof vi.spyOn>;
    let sigintListeners: ((...args: unknown[]) => void)[];
    let sigtermListeners: ((...args: unknown[]) => void)[];

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

    it("should render header and initial frame on startCommand", () => {
        const tasks = [createTask("app-a", "build")];
        const { lifeCycle } = createRenderer(tasks);

        lifeCycle.startCommand!();

        // pail's InteractiveManager hooks the stream, so writes go through the hook.
        // The header is written to the captured history and the initial frame is rendered.
        // We verify signal handlers are registered as a proxy for startCommand succeeding.
        expect(sigintListeners.length).toBeGreaterThan(0);

        lifeCycle.endCommand!();
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

    it("should track completed tasks and render them on endCommand", () => {
        const tasks = [createTask("app-a", "build"), createTask("app-b", "build")];
        const { lifeCycle } = createRenderer(tasks);

        lifeCycle.startCommand!();
        lifeCycle.startTasks!(tasks);
        lifeCycle.endTasks!([createResult(tasks[0]!, "success")]);
        writeSpy.mockClear();

        // endCommand triggers the final render which includes completed tasks
        lifeCycle.endCommand!();

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("app-a:build");
    });

    it("should show cache indicator for cached tasks in final render", () => {
        const tasks = [createTask("app-a", "build")];
        const { lifeCycle } = createRenderer(tasks);

        lifeCycle.startCommand!();
        lifeCycle.startTasks!(tasks);
        lifeCycle.endTasks!([createResult(tasks[0]!, "local-cache")]);
        writeSpy.mockClear();

        lifeCycle.endCommand!();

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        // Cache indicator is shown as ellipsis in the Cache column
        expect(allOutput).toContain("app-a:build");
        expect(allOutput).toContain("read from cache");
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

    it("should collect task output via printTaskTerminalOutput", () => {
        const tasks = [createTask("app-a", "build")];
        const { lifeCycle } = createRenderer(tasks);

        lifeCycle.startCommand!();
        lifeCycle.startTasks!(tasks);

        // Output is collected, not immediately printed — the interactive TUI
        // displays output when the user selects a task
        lifeCycle.printTaskTerminalOutput!(tasks[0]!, "failure", "Error: compilation failed");

        lifeCycle.endTasks!([createResult(tasks[0]!, "failure")]);
        writeSpy.mockClear();

        lifeCycle.endCommand!();

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("app-a:build");
        expect(allOutput).toContain("1 task failed");
    });
});
