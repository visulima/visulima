import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Cache } from "../../src/cache";
import { EmptyLifeCycle } from "../../src/life-cycle";
import { InProcessTaskHasher } from "../../src/task-hasher";
import { TaskOrchestrator } from "../../src/task-orchestrator";
import { TaskScheduler } from "../../src/task-scheduler";
import type { LifeCycleInterface, ProjectGraph, Task, TaskExecutor, TaskGraph } from "../../src/types";
import type { WhenContext } from "../../src/when-condition";

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `orch-when-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

describe("orchestrator: when + always", () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();

        await mkdir(join(workspaceRoot, "packages/app/src"), { recursive: true });
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    const buildOrchestrator = (
        tasks: Task[],
        executor: TaskExecutor,
        options: {
            alwaysTasks?: Task[];
            lifeCycle?: LifeCycleInterface;
            whenContext?: WhenContext;
        } = {},
    ) => {
        const taskGraph: TaskGraph = {
            dependencies: Object.fromEntries(tasks.map((t) => [t.id, []])),
            roots: tasks.map((t) => t.id),
            tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
        };

        const projectGraph: ProjectGraph = {
            dependencies: { app: [] },
            nodes: {
                app: {
                    data: { root: "packages/app" },
                    name: "app",
                    type: "application",
                },
            },
        };

        const cache = new Cache({ workspaceRoot });
        const taskHasher = new InProcessTaskHasher({
            projects: { app: { root: "packages/app" } },
            workspaceRoot,
        });
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 3);

        return new TaskOrchestrator({
            alwaysTasks: options.alwaysTasks,
            cache,
            lifeCycle: options.lifeCycle ?? new EmptyLifeCycle(),
            scheduler,
            skipCache: true,
            taskExecutor: executor,
            taskGraph,
            taskHasher,
            whenContext: options.whenContext ?? { branch: "" },
            workspaceRoot,
        });
    };

    it("skips a task whose `when.os` does not match the current platform", async () => {
        expect.assertions(3);

        const task: Task = {
            id: "app:lint",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "lint" },
            when: { os: "freebsd" },
        };

        let runCount = 0;
        const executor: TaskExecutor = async () => {
            runCount += 1;

            return { code: 0, terminalOutput: "ran" };
        };

        const results = await buildOrchestrator([task], executor, {
            whenContext: { branch: "", env: {}, platform: "linux" },
        }).run();

        expect(runCount).toBe(0);
        expect(results.get("app:lint")?.status).toBe("skipped");
        expect(results.get("app:lint")?.terminalOutput).toContain("Skipped");
    });

    it("runs a task whose `when` matches", async () => {
        expect.assertions(2);

        const task: Task = {
            id: "app:build",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "build" },
            when: { ci: true },
        };

        let runCount = 0;
        const executor: TaskExecutor = async () => {
            runCount += 1;

            return { code: 0, terminalOutput: "built" };
        };

        const results = await buildOrchestrator([task], executor, {
            whenContext: { branch: "main", env: { CI: "true" }, platform: "linux" },
        }).run();

        expect(runCount).toBe(1);
        expect(results.get("app:build")?.status).toBe("success");
    });

    it("invokes printWhenSkip lifecycle hook with a reason", async () => {
        expect.assertions(2);

        const skipped: { reason: string; taskId: string }[] = [];
        const lifeCycle: LifeCycleInterface = {
            printWhenSkip(task, reason) {
                skipped.push({ reason, taskId: task.id });
            },
        };

        const task: Task = {
            id: "app:deploy",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "deploy" },
            when: { branch: "main" },
        };

        const executor: TaskExecutor = async () => { return { code: 0, terminalOutput: "" }; };

        await buildOrchestrator([task], executor, {
            lifeCycle,
            whenContext: { branch: "feat/x", env: {}, platform: "linux" },
        }).run();

        expect(skipped).toHaveLength(1);
        expect(skipped[0]?.reason).toContain("branch=feat/x");
    });

    it("runs always tasks after the main task graph completes", async () => {
        expect.assertions(3);

        const order: string[] = [];

        const main: Task = {
            id: "app:build",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "build" },
        };

        const finallyTask: Task = {
            always: true,
            id: "app:cleanup",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "cleanup" },
        };

        const executor: TaskExecutor = async (task) => {
            order.push(task.id);

            return { code: 0, terminalOutput: "" };
        };

        const results = await buildOrchestrator([main], executor, {
            alwaysTasks: [finallyTask],
        }).run();

        expect(order).toStrictEqual(["app:build", "app:cleanup"]);
        expect(results.get("app:build")?.status).toBe("success");
        expect(results.get("app:cleanup")?.status).toBe("success");
    });

    it("still runs always tasks after a main task fails", async () => {
        expect.assertions(2);

        const main: Task = {
            id: "app:build",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "build" },
        };

        const finallyTask: Task = {
            always: true,
            id: "app:cleanup",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "cleanup" },
        };

        let cleanupRan = false;
        const executor: TaskExecutor = async (task) => {
            if (task.id === "app:cleanup") {
                cleanupRan = true;

                return { code: 0, terminalOutput: "cleaned" };
            }

            return { code: 1, terminalOutput: "failed" };
        };

        const results = await buildOrchestrator([main], executor, {
            alwaysTasks: [finallyTask],
        }).run();

        expect(cleanupRan).toBe(true);
        expect(results.get("app:build")?.status).toBe("failure");
    });

    it("honours `when` on always tasks", async () => {
        expect.assertions(2);

        const finallyTask: Task = {
            always: true,
            id: "app:report",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "report" },
            when: { ci: true },
        };

        let runCount = 0;
        const executor: TaskExecutor = async () => {
            runCount += 1;

            return { code: 0, terminalOutput: "" };
        };

        const results = await buildOrchestrator([], executor, {
            alwaysTasks: [finallyTask],
            whenContext: { branch: "", env: {}, platform: "linux" },
        }).run();

        expect(runCount).toBe(0);
        expect(results.get("app:report")?.status).toBe("skipped");
    });

    it("runs multiple always tasks in declaration order", async () => {
        expect.assertions(1);

        const order: string[] = [];

        const a: Task = {
            always: true,
            id: "app:a",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "a" },
        };

        const b: Task = {
            always: true,
            id: "app:b",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "b" },
        };

        const executor: TaskExecutor = async (task) => {
            order.push(`order:${task.id}`);

            return { code: 0, terminalOutput: `done ${task.id}` };
        };

        await buildOrchestrator([], executor, { alwaysTasks: [a, b] }).run();

        expect(order).toStrictEqual(["order:app:a", "order:app:b"]);
    });

    it("skips always tasks when the main run was aborted via SIGINT", async () => {
        expect.assertions(2);

        const main: Task = {
            id: "app:build",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "build" },
        };

        const finallyTask: Task = {
            always: true,
            id: "app:cleanup",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "cleanup" },
        };

        let cleanupRan = false;
        const executor: TaskExecutor = async (task) => {
            if (task.id === "app:build") {
                process.emit("SIGINT");

                return { code: 130, terminalOutput: "interrupted" };
            }

            cleanupRan = true;

            return { code: 0, terminalOutput: "" };
        };

        const results = await buildOrchestrator([main], executor, {
            alwaysTasks: [finallyTask],
        }).run();

        expect(cleanupRan).toBe(false);
        expect(results.has("app:cleanup")).toBe(false);
    });

    it("continues running subsequent always tasks after one fails", async () => {
        expect.assertions(3);

        const order: string[] = [];

        const a: Task = {
            always: true,
            id: "app:a",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "a" },
        };

        const b: Task = {
            always: true,
            id: "app:b",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "b" },
        };

        const executor: TaskExecutor = async (task) => {
            order.push(`run:${task.id}`);

            if (task.id === "app:a") {
                return { code: 1, terminalOutput: "boom" };
            }

            return { code: 0, terminalOutput: "ok" };
        };

        const results = await buildOrchestrator([], executor, { alwaysTasks: [a, b] }).run();

        expect(order).toStrictEqual(["run:app:a", "run:app:b"]);
        expect(results.get("app:a")?.status).toBe("failure");
        expect(results.get("app:b")?.status).toBe("success");
    });
});
