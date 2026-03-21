import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { TaskOrchestrator } from "../src/task-orchestrator";
import { Cache } from "../src/cache";
import { InProcessTaskHasher } from "../src/task-hasher";
import { TaskScheduler } from "../src/task-scheduler";
import { EmptyLifeCycle } from "../src/life-cycle";
import type { Task, TaskGraph, ProjectGraph, TaskExecutor, LifeCycleInterface } from "../src/types";

const createTmpDir = async (): Promise<string> => {
    const dir = join(tmpdir(), `orch-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(dir, { recursive: true });

    return dir;
};

describe("TaskOrchestrator", () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTmpDir();

        // Create a minimal project
        await mkdir(join(workspaceRoot, "packages/app/src"), { recursive: true });

        const { writeFile } = await import("node:fs/promises");

        await writeFile(join(workspaceRoot, "packages/app/src/index.ts"), "const x = 1;");
    });

    afterEach(async () => {
        await rm(workspaceRoot, { recursive: true, force: true });
    });

    const createOrchestrator = (
        tasks: Task[],
        executor: TaskExecutor,
        options: {
            autoFingerprint?: boolean;
            skipCache?: boolean;
            lifeCycle?: LifeCycleInterface;
            dependencies?: Record<string, string[]>;
        } = {},
    ) => {
        const taskGraph: TaskGraph = {
            roots: tasks.map((t) => t.id),
            tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
            dependencies: options.dependencies ?? Object.fromEntries(tasks.map((t) => [t.id, []])),
        };

        const projectGraph: ProjectGraph = {
            nodes: {
                app: {
                    name: "app",
                    type: "application",
                    data: { root: "packages/app" },
                },
            },
            dependencies: { app: [] },
        };

        const cache = new Cache({ workspaceRoot });
        const taskHasher = new InProcessTaskHasher({
            workspaceRoot,
            projects: { app: { root: "packages/app" } },
        });
        const scheduler = new TaskScheduler(taskGraph, projectGraph, 3);
        const lifeCycle = options.lifeCycle ?? new EmptyLifeCycle();

        return new TaskOrchestrator({
            taskHasher,
            cache,
            scheduler,
            lifeCycle,
            taskExecutor: executor,
            workspaceRoot,
            skipCache: options.skipCache,
            autoFingerprint: options.autoFingerprint,
        });
    };

    it("should execute a simple task", async () => {
        const task: Task = {
            id: "app:build",
            target: { project: "app", target: "build" },
            overrides: {},
            outputs: [],
            projectRoot: "packages/app",
        };

        const executor: TaskExecutor = async () => ({
            code: 0,
            terminalOutput: "Build successful",
        });

        const orchestrator = createOrchestrator([task], executor);
        const results = await orchestrator.run();

        expect(results.size).toBe(1);

        const result = results.get("app:build");

        expect(result?.status).toBe("success");
        expect(result?.terminalOutput).toBe("Build successful");
    });

    it("should cache successful results", async () => {
        const task: Task = {
            id: "app:build",
            target: { project: "app", target: "build" },
            overrides: {},
            outputs: [],
            projectRoot: "packages/app",
        };

        let executionCount = 0;
        const executor: TaskExecutor = async () => {
            executionCount++;
            return { code: 0, terminalOutput: "Build successful" };
        };

        // First run
        const orch1 = createOrchestrator([task], executor);

        await orch1.run();

        expect(executionCount).toBe(1);

        // Second run should use cache
        const orch2 = createOrchestrator([task], executor);
        const results2 = await orch2.run();
        const result = results2.get("app:build");

        expect(result?.status).toBe("local-cache");
        expect(executionCount).toBe(1); // Not called again
    });

    it("should not cache failed tasks", async () => {
        const task: Task = {
            id: "app:build",
            target: { project: "app", target: "build" },
            overrides: {},
            outputs: [],
            projectRoot: "packages/app",
        };

        let executionCount = 0;
        const executor: TaskExecutor = async () => {
            executionCount++;
            return { code: 1, terminalOutput: "Build failed" };
        };

        // First run
        const orch1 = createOrchestrator([task], executor);

        await orch1.run();

        // Second run should execute again (not cached)
        const orch2 = createOrchestrator([task], executor);

        await orch2.run();

        expect(executionCount).toBe(2);
    });

    it("should skip cache when skipCache is true", async () => {
        const task: Task = {
            id: "app:build",
            target: { project: "app", target: "build" },
            overrides: {},
            outputs: [],
            projectRoot: "packages/app",
        };

        let executionCount = 0;
        const executor: TaskExecutor = async () => {
            executionCount++;
            return { code: 0, terminalOutput: "Built" };
        };

        // First run - caches
        const orch1 = createOrchestrator([task], executor);

        await orch1.run();

        // Second run with skipCache - should execute again
        const orch2 = createOrchestrator([task], executor, { skipCache: true });

        await orch2.run();

        expect(executionCount).toBe(2);
    });

    it("should handle executor errors gracefully", async () => {
        const task: Task = {
            id: "app:build",
            target: { project: "app", target: "build" },
            overrides: {},
            outputs: [],
            projectRoot: "packages/app",
        };

        const executor: TaskExecutor = async () => {
            throw new Error("Executor crashed");
        };

        const orchestrator = createOrchestrator([task], executor);
        const results = await orchestrator.run();
        const result = results.get("app:build");

        expect(result?.status).toBe("failure");
        expect(result?.terminalOutput).toContain("Executor crashed");
    });

    it("should execute tasks with auto-fingerprint mode", async () => {
        const task: Task = {
            id: "app:build",
            target: { project: "app", target: "build" },
            overrides: {},
            outputs: [],
            projectRoot: "packages/app",
        };

        const executor: TaskExecutor = async () => ({
            code: 0,
            terminalOutput: "Built with fingerprint",
        });

        const orchestrator = createOrchestrator([task], executor, { autoFingerprint: true });
        const results = await orchestrator.run();
        const result = results.get("app:build");

        expect(result?.status).toBe("success");
    });

    describe("signal handling", () => {
        it("should stop processing on SIGINT", async () => {
            const task1: Task = {
                id: "app:build",
                target: { project: "app", target: "build" },
                overrides: {},
                outputs: [],
                projectRoot: "packages/app",
            };

            const task2: Task = {
                id: "app:test",
                target: { project: "app", target: "test" },
                overrides: {},
                outputs: [],
                projectRoot: "packages/app",
            };

            let executionCount = 0;
            const executor: TaskExecutor = async () => {
                executionCount++;

                if (executionCount === 1) {
                    // After first task starts, simulate SIGINT
                    process.emit("SIGINT", "SIGINT");
                }

                return { code: 0, terminalOutput: `Task ${executionCount}` };
            };

            // task2 depends on task1, so they run sequentially
            const orchestrator = createOrchestrator([task1, task2], executor, {
                dependencies: {
                    "app:build": [],
                    "app:test": ["app:build"],
                },
            });

            const results = await orchestrator.run();

            // First task completed but second should have been skipped due to abort
            expect(executionCount).toBe(1);
            expect(results.size).toBe(1);
        });

        it("should clean up signal listeners after run", async () => {
            const task: Task = {
                id: "app:build",
                target: { project: "app", target: "build" },
                overrides: {},
                outputs: [],
                projectRoot: "packages/app",
            };

            const executor: TaskExecutor = async () => ({
                code: 0,
                terminalOutput: "done",
            });

            const listenerCountBefore = process.listenerCount("SIGINT");

            const orchestrator = createOrchestrator([task], executor);

            await orchestrator.run();

            const listenerCountAfter = process.listenerCount("SIGINT");

            expect(listenerCountAfter).toBe(listenerCountBefore);
        });

        it("should clean up signal listeners even when tasks fail", async () => {
            const task: Task = {
                id: "app:build",
                target: { project: "app", target: "build" },
                overrides: {},
                outputs: [],
                projectRoot: "packages/app",
            };

            const executor: TaskExecutor = async () => {
                throw new Error("boom");
            };

            const listenerCountBefore = process.listenerCount("SIGINT");

            const orchestrator = createOrchestrator([task], executor);

            await orchestrator.run();

            const listenerCountAfter = process.listenerCount("SIGINT");

            expect(listenerCountAfter).toBe(listenerCountBefore);
        });
    });

    describe("lifecycle hooks", () => {
        it("should call startCommand and endCommand", async () => {
            const task: Task = {
                id: "app:build",
                target: { project: "app", target: "build" },
                overrides: {},
                outputs: [],
                projectRoot: "packages/app",
            };

            const lifeCycle: LifeCycleInterface = {
                startCommand: vi.fn(),
                endCommand: vi.fn(),
            };

            const executor: TaskExecutor = async () => ({
                code: 0,
                terminalOutput: "done",
            });

            const orchestrator = createOrchestrator([task], executor, { lifeCycle });

            await orchestrator.run();

            expect(lifeCycle.startCommand).toHaveBeenCalledOnce();
            expect(lifeCycle.endCommand).toHaveBeenCalledOnce();
        });

        it("should call endCommand even when task fails", async () => {
            const task: Task = {
                id: "app:build",
                target: { project: "app", target: "build" },
                overrides: {},
                outputs: [],
                projectRoot: "packages/app",
            };

            const lifeCycle: LifeCycleInterface = {
                startCommand: vi.fn(),
                endCommand: vi.fn(),
            };

            const executor: TaskExecutor = async () => {
                throw new Error("crash");
            };

            const orchestrator = createOrchestrator([task], executor, { lifeCycle });

            await orchestrator.run();

            expect(lifeCycle.endCommand).toHaveBeenCalledOnce();
        });

        it("should call scheduleTask for each task", async () => {
            const task: Task = {
                id: "app:build",
                target: { project: "app", target: "build" },
                overrides: {},
                outputs: [],
                projectRoot: "packages/app",
            };

            const lifeCycle: LifeCycleInterface = {
                scheduleTask: vi.fn(),
            };

            const executor: TaskExecutor = async () => ({
                code: 0,
                terminalOutput: "done",
            });

            const orchestrator = createOrchestrator([task], executor, { lifeCycle });

            await orchestrator.run();

            expect(lifeCycle.scheduleTask).toHaveBeenCalledWith(
                expect.objectContaining({ id: "app:build" }),
            );
        });

        it("should call startTasks and endTasks", async () => {
            const task: Task = {
                id: "app:build",
                target: { project: "app", target: "build" },
                overrides: {},
                outputs: [],
                projectRoot: "packages/app",
            };

            const lifeCycle: LifeCycleInterface = {
                startTasks: vi.fn(),
                endTasks: vi.fn(),
            };

            const executor: TaskExecutor = async () => ({
                code: 0,
                terminalOutput: "done",
            });

            const orchestrator = createOrchestrator([task], executor, { lifeCycle });

            await orchestrator.run();

            expect(lifeCycle.startTasks).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({ id: "app:build" })]),
            );
            expect(lifeCycle.endTasks).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        task: expect.objectContaining({ id: "app:build" }),
                        status: "success",
                    }),
                ]),
            );
        });

        it("should call printTaskTerminalOutput for tasks with output", async () => {
            const task: Task = {
                id: "app:build",
                target: { project: "app", target: "build" },
                overrides: {},
                outputs: [],
                projectRoot: "packages/app",
            };

            const lifeCycle: LifeCycleInterface = {
                printTaskTerminalOutput: vi.fn(),
            };

            const executor: TaskExecutor = async () => ({
                code: 0,
                terminalOutput: "Build output here",
            });

            const orchestrator = createOrchestrator([task], executor, { lifeCycle });

            await orchestrator.run();

            expect(lifeCycle.printTaskTerminalOutput).toHaveBeenCalledWith(
                expect.objectContaining({ id: "app:build" }),
                "success",
                "Build output here",
            );
        });

        it("should report failure status in lifecycle hooks", async () => {
            const task: Task = {
                id: "app:build",
                target: { project: "app", target: "build" },
                overrides: {},
                outputs: [],
                projectRoot: "packages/app",
            };

            const lifeCycle: LifeCycleInterface = {
                endTasks: vi.fn(),
            };

            const executor: TaskExecutor = async () => ({
                code: 1,
                terminalOutput: "Build failed",
            });

            const orchestrator = createOrchestrator([task], executor, { lifeCycle });

            await orchestrator.run();

            expect(lifeCycle.endTasks).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        status: "failure",
                        code: 1,
                    }),
                ]),
            );
        });
    });
});
