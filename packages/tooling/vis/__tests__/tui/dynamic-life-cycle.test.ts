import type { Task, TaskResult } from "@visulima/task-runner";
import { render } from "@visulima/tui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDynamicOutputRenderer } from "../../src/tui/dynamic-life-cycle";

// Mock @visulima/tui render to avoid actual terminal rendering
let mockUnmount: () => void;
let mockWaitUntilExit: () => Promise<void>;
let exitResolve: () => void;

vi.mock(import("@visulima/tui"), async (importOriginal) => {
    const actual = await importOriginal<typeof import("@visulima/tui")>();

    return {
        ...actual,
        render: vi.fn(() => {
            const waitPromise = new Promise<void>((resolve) => {
                exitResolve = resolve;
            });

            mockUnmount = () => {
                exitResolve?.();
            };
            mockWaitUntilExit = () => waitPromise;

            return {
                cleanup: vi.fn(),
                clear: vi.fn(),
                rerender: vi.fn(),
                rootNode: {},
                unmount: vi.fn(() => {
                    mockUnmount();
                }),
                waitUntilExit: vi.fn(() => mockWaitUntilExit()),
                waitUntilRenderFlush: vi.fn(() => Promise.resolve()),
            };
        }),
    };
});

const createTask = (project: string, target: string): Task => {
    return {
        id: `${project}:${target}`,
        outputs: [],
        overrides: {},
        target: { project, target },
    };
};

const createResult = (task: Task, status: "failure" | "local-cache" | "success" = "success"): TaskResult => {
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
        expect.assertions(2);

        const tasks = [createTask("app-a", "build")];
        const result = createRenderer(tasks);

        expect(result.lifeCycle).toBeDefined();
        expect(result.renderIsDone).toBeInstanceOf(Promise);
    });

    it("should register signal handlers on startCommand", () => {
        expect.assertions(2);

        const tasks = [createTask("app-a", "build")];
        const { lifeCycle } = createRenderer(tasks);

        lifeCycle.startCommand!();

        expect(sigintListeners.length).toBeGreaterThan(0);
        expect(sigtermListeners.length).toBeGreaterThan(0);

        lifeCycle.endCommand!();
    });

    it("should call render with alternateScreen on startCommand", () => {
        expect.assertions(1);

        const tasks = [createTask("app-a", "build")];
        const { lifeCycle } = createRenderer(tasks);

        lifeCycle.startCommand!();

        expect(render).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ alternateScreen: true }));

        lifeCycle.endCommand!();
    });

    it("should accept startTasks and endTasks without errors", () => {
        expect.assertions(1);

        const tasks = [createTask("app-a", "build")];
        const { lifeCycle } = createRenderer(tasks);

        expect(() => {
            lifeCycle.startCommand!();
            lifeCycle.startTasks!(tasks);
            lifeCycle.endTasks!([createResult(tasks[0]!, "success")]);
            lifeCycle.endCommand!();
        }).not.toThrow();
    });

    it("should resolve renderIsDone after app unmounts", async () => {
        expect.assertions(1);

        const tasks = [createTask("app-a", "build")];
        const { lifeCycle, renderIsDone } = createRenderer(tasks);

        lifeCycle.startCommand!();
        lifeCycle.startTasks!(tasks);
        lifeCycle.endTasks!([createResult(tasks[0]!, "success")]);
        lifeCycle.endCommand!();

        // Simulate the app exiting (unmount resolves waitUntilExit)
        mockUnmount();

        await expect(renderIsDone).resolves.toBeUndefined();
    });

    it("should print summary after app exits", async () => {
        expect.assertions(3);

        const tasks = [createTask("app-a", "build")];
        const { lifeCycle, renderIsDone } = createRenderer(tasks);

        lifeCycle.startCommand!();
        lifeCycle.startTasks!(tasks);
        lifeCycle.endTasks!([createResult(tasks[0]!, "success")]);
        lifeCycle.endCommand!();

        writeSpy.mockClear();
        mockUnmount();

        await renderIsDone;

        // Summary should be printed to stdout after alternate screen restores
        expect(writeSpy.mock.calls.length).toBeGreaterThan(0);

        const allOutput = writeSpy.mock.calls.map((c) => String(c[0])).join("");

        expect(allOutput).toContain("vis run app-a:build");
        expect(allOutput).toContain("Successfully ran target build");
    });

    it("should dump successful task output below the summary in normal mode", async () => {
        expect.assertions(2);

        const tasks = [createTask("app-a", "build")];
        const { lifeCycle, renderIsDone } = createRenderer(tasks);

        lifeCycle.startCommand!();
        lifeCycle.startTasks!(tasks);
        lifeCycle.endTasks!([createResult(tasks[0]!, "success")]);
        lifeCycle.endCommand!();

        writeSpy.mockClear();
        mockUnmount();

        await renderIsDone;

        const allOutput = writeSpy.mock.calls.map((c) => String(c[0])).join("");

        // Successful task output survives the alternate-screen teardown,
        // matching the non-TTY StaticOutputLifeCycle normal contract.
        expect(allOutput).toContain("output for app-a:build");
        expect(allOutput).toContain("Successfully ran target build");
    });

    it("should suppress the output dump in quiet mode", async () => {
        expect.assertions(2);

        const tasks = [createTask("app-a", "build")];
        const { lifeCycle, renderIsDone } = createDynamicOutputRenderer({
            args: { parallel: 3, targets: ["build"] },
            outputStyle: "quiet",
            projectNames: ["app-a"],
            tasks,
        });

        lifeCycle.startCommand!();
        lifeCycle.startTasks!(tasks);
        lifeCycle.endTasks!([createResult(tasks[0]!, "success")]);
        lifeCycle.endCommand!();

        writeSpy.mockClear();
        mockUnmount();

        await renderIsDone;

        const allOutput = writeSpy.mock.calls.map((c) => String(c[0])).join("");

        // The summary still prints, but the task body stays in the TUI
        // scrollback rather than being re-emitted below it.
        expect(allOutput).toContain("Successfully ran target build");
        expect(allOutput).not.toContain("output for app-a:build");
    });

    it("should collect task output via printTaskTerminalOutput", () => {
        expect.assertions(1);

        const tasks = [createTask("app-a", "build")];
        const { lifeCycle } = createRenderer(tasks);

        expect(() => {
            lifeCycle.startCommand!();
            lifeCycle.startTasks!(tasks);

            lifeCycle.printTaskTerminalOutput!(tasks[0]!, "failure", "Error: compilation failed");

            lifeCycle.endTasks!([createResult(tasks[0]!, "failure")]);
            lifeCycle.endCommand!();
        }).not.toThrow();
    });
});
