import { describe, expect, it, vi } from "vitest";

import { CompositeLifeCycle, ConsoleLifeCycle, EmptyLifeCycle } from "../src/life-cycle";
import type { LifeCycleInterface, Task, TaskResult } from "../src/types";

const createTask = (id: string): Task => {
    return {
        id,
        outputs: [],
        overrides: {},
        target: { project: id.split(":")[0] as string, target: id.split(":")[1] as string },
    };
};

const createResult = (taskId: string, status: "success" | "failure" = "success"): TaskResult => {
    return {
        code: status === "success" ? 0 : 1,
        endTime: 2000,
        startTime: 1000,
        status,
        task: createTask(taskId),
        terminalOutput: `output for ${taskId}`,
    };
};

describe(EmptyLifeCycle, () => {
    it("should not throw when methods are called", () => {
        const lc = new EmptyLifeCycle();

        expect(() => {
            lc.startCommand?.();
            lc.endCommand?.();
            lc.scheduleTask?.(createTask("a:build"));
            lc.startTasks?.([createTask("a:build")]);
            lc.endTasks?.([createResult("a:build")]);
            lc.printTaskTerminalOutput?.(createTask("a:build"), "success", "output");
        }).not.toThrow();
    });
});

describe(CompositeLifeCycle, () => {
    it("should forward events to all registered handlers", () => {
        const handler1: LifeCycleInterface = {
            endCommand: vi.fn(),
            scheduleTask: vi.fn(),
            startCommand: vi.fn(),
        };

        const handler2: LifeCycleInterface = {
            scheduleTask: vi.fn(),
            startCommand: vi.fn(),
        };

        const composite = new CompositeLifeCycle([handler1, handler2]);

        composite.startCommand();
        composite.endCommand();
        composite.scheduleTask(createTask("a:build"));

        expect(handler1.startCommand).toHaveBeenCalledTimes(1);
        expect(handler2.startCommand).toHaveBeenCalledTimes(1);
        expect(handler1.endCommand).toHaveBeenCalledTimes(1);
        expect(handler1.scheduleTask).toHaveBeenCalledWith(expect.objectContaining({ id: "a:build" }));
        expect(handler2.scheduleTask).toHaveBeenCalledWith(expect.objectContaining({ id: "a:build" }));
    });

    it("should forward printCacheMiss to all handlers", () => {
        const handler: LifeCycleInterface = {
            printCacheMiss: vi.fn(),
        };

        const composite = new CompositeLifeCycle([handler]);
        const task = createTask("a:build");

        composite.printCacheMiss(task, "File changed: src/index.ts");

        expect(handler.printCacheMiss).toHaveBeenCalledWith(task, "File changed: src/index.ts");
    });
});

describe(ConsoleLifeCycle, () => {
    it("should log task starts", () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const lc = new ConsoleLifeCycle();

        lc.startTasks([createTask("a:build")]);

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("a:build"));

        consoleSpy.mockRestore();
    });

    it("should log task results with duration", () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const lc = new ConsoleLifeCycle();

        lc.endTasks([createResult("a:build")]);

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("a:build"));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("1000ms"));

        consoleSpy.mockRestore();
    });

    it("should log verbose messages in verbose mode", () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const lc = new ConsoleLifeCycle(true);

        lc.startCommand();

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Starting"));

        consoleSpy.mockRestore();
    });

    it("should log cache miss in verbose mode", () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const lc = new ConsoleLifeCycle(true);

        lc.printCacheMiss(createTask("a:build"), "File changed");

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("File changed"));

        consoleSpy.mockRestore();
    });
});
