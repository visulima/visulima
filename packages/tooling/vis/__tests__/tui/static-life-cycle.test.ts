import { strip } from "@visulima/colorize";
import type { Task, TaskResult } from "@visulima/task-runner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseOutputStyle, resolveOutputStyle, StaticOutputLifeCycle } from "../../src/tui/static-life-cycle";

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
        expect.assertions(2);

        const tasks = [createTask("app-a", "build")];
        const lc = createLifeCycle(tasks);

        lc.startCommand();

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("VIS");
        expect(allOutput).toContain("Running");
    });

    it("should print task IDs on startTasks", () => {
        expect.assertions(2);

        const tasks = [createTask("app-a", "build"), createTask("app-b", "build")];
        const lc = createLifeCycle(tasks);

        lc.startTasks(tasks);

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("app-a:build");
        expect(allOutput).toContain("app-b:build");
    });

    it("should print results with status icons on endTasks", () => {
        expect.assertions(1);

        const task = createTask("app-a", "build");
        const lc = createLifeCycle([task]);

        lc.endTasks([createResult(task, "success")]);

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("app-a:build");
    });

    it("should show [cache] label for cached tasks", () => {
        expect.assertions(1);

        const task = createTask("app-a", "build");
        const lc = createLifeCycle([task]);

        lc.endTasks([createResult(task, "local-cache")]);

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("[cache]");
    });

    it("should print success summary when all tasks pass", () => {
        expect.assertions(2);

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
        expect.assertions(1);

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
        expect.assertions(2);

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
        expect.assertions(2);

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
        expect.assertions(1);

        const task = createTask("app-a", "build");
        const lc = createLifeCycle([task]);

        lc.printTaskTerminalOutput(task, "failure", "Error: something broke");

        const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

        expect(allOutput).toContain("Error: something broke");
    });

    describe("outputStyle: quiet", () => {
        const createQuietLifeCycle = (tasks: Task[]): StaticOutputLifeCycle =>
            new StaticOutputLifeCycle({
                args: { targets: ["build"] },
                outputStyle: "quiet",
                projectNames: [...new Set(tasks.map((t) => t.target.project))],
                tasks,
            });

        it("suppresses successful task output", () => {
            expect.assertions(1);

            const task = createTask("app-a", "build");
            const lc = createQuietLifeCycle([task]);

            lc.printTaskTerminalOutput(task, "success", "Compiled in 2.4s");

            const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

            expect(allOutput).not.toContain("Compiled in 2.4s");
        });

        it("suppresses cached task output", () => {
            expect.assertions(2);

            const task = createTask("app-a", "build");
            const lc = createQuietLifeCycle([task]);

            lc.printTaskTerminalOutput(task, "local-cache", "(cached output)");
            lc.printTaskTerminalOutput(task, "remote-cache", "(remote cached)");

            const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

            expect(allOutput).not.toContain("cached output");
            expect(allOutput).not.toContain("remote cached");
        });

        it("still prints failed task output", () => {
            expect.assertions(1);

            const task = createTask("app-a", "build");
            const lc = createQuietLifeCycle([task]);

            lc.printTaskTerminalOutput(task, "failure", "Error: something broke");

            const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

            expect(allOutput).toContain("Error: something broke");
        });

        it("per-task outputStyle override beats global quiet", () => {
            // Reverse case: global=quiet, but this task wants normal — its
            // success output should print despite the global silence.
            expect.assertions(1);

            const task: Task = {
                id: "noisy:build",
                outputs: [],
                overrides: { visOptions: { outputStyle: "normal" } },
                target: { project: "noisy", target: "build" },
            };

            const lc = createQuietLifeCycle([task]);

            lc.printTaskTerminalOutput(task, "success", "noisy success line");

            const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

            expect(allOutput).toContain("noisy success line");
        });

        it("per-task outputStyle override mutes a task even with normal global", () => {
            expect.assertions(1);

            const task: Task = {
                id: "quiet:build",
                outputs: [],
                overrides: { visOptions: { outputStyle: "quiet" } },
                target: { project: "quiet", target: "build" },
            };

            const lc = createLifeCycle([task]);

            lc.printTaskTerminalOutput(task, "success", "muted on success");

            const allOutput = writeSpy.mock.calls.map((c) => strip(String(c[0]))).join("");

            expect(allOutput).not.toContain("muted on success");
        });
    });
});

describe(parseOutputStyle, () => {
    it("returns 'quiet' for the quiet string", () => {
        expect.assertions(1);

        expect(parseOutputStyle("quiet")).toBe("quiet");
    });

    it("returns 'normal' for an explicit normal string", () => {
        expect.assertions(1);

        expect(parseOutputStyle("normal")).toBe("normal");
    });

    it("returns 'normal' for undefined (default)", () => {
        expect.assertions(1);

        expect(parseOutputStyle(undefined)).toBe("normal");
    });

    it("falls back to 'normal' for unknown values to avoid silently muting output", () => {
        expect.assertions(2);

        expect(parseOutputStyle("verbose")).toBe("normal");
        expect(parseOutputStyle("loud")).toBe("normal");
    });
});

describe(resolveOutputStyle, () => {
    it("defaults to 'normal' when neither flag nor config is set", () => {
        expect.assertions(1);

        expect(resolveOutputStyle(undefined, undefined)).toBe("normal");
    });

    it("returns 'quiet' when quietOnSuccess is enabled and no flag is given", () => {
        expect.assertions(1);

        expect(resolveOutputStyle(undefined, true)).toBe("quiet");
    });

    it("returns 'normal' when quietOnSuccess is explicitly disabled", () => {
        expect.assertions(1);

        expect(resolveOutputStyle(undefined, false)).toBe("normal");
    });

    it("lets an explicit --output-style flag win over the config (quiet flag, config off)", () => {
        expect.assertions(1);

        expect(resolveOutputStyle("quiet", false)).toBe("quiet");
    });

    it("lets an explicit --output-style flag win over the config (normal flag, config on)", () => {
        expect.assertions(1);

        expect(resolveOutputStyle("normal", true)).toBe("normal");
    });

    it("parses the flag case-insensitively when callers pass mixed case", () => {
        expect.assertions(1);

        expect(resolveOutputStyle("QUIET".toLowerCase(), false)).toBe("quiet");
    });

    it("falls back to 'normal' for an unknown flag even when quietOnSuccess is on", () => {
        expect.assertions(1);

        expect(resolveOutputStyle("verbose", true)).toBe("normal");
    });
});
