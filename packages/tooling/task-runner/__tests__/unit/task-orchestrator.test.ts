import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Cache } from "../../src/cache";
import { EmptyLifeCycle } from "../../src/life-cycle";
import { InProcessTaskHasher } from "../../src/task-hasher";
import { TaskOrchestrator } from "../../src/task-orchestrator";
import { TaskScheduler } from "../../src/task-scheduler";
import type { LifeCycleInterface, ProjectGraph, Task, TaskExecutor, TaskGraph, TaskResult, TaskStatus } from "../../src/types";

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `orch-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

describe(TaskOrchestrator, () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();

        // Create a minimal project
        await mkdir(join(workspaceRoot, "packages/app/src"), { recursive: true });

        const { writeFile } = await import("node:fs/promises");

        await writeFile(join(workspaceRoot, "packages/app/src/index.ts"), "const x = 1;");
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    const successExecutor: TaskExecutor = async () => {
        return {
            code: 0,
            terminalOutput: "done",
        };
    };

    const createOrchestrator = (
        tasks: Task[],
        executor: TaskExecutor,
        options: {
            autoFingerprint?: boolean;
            dependencies?: Record<string, string[]>;
            lifeCycle?: LifeCycleInterface;
            skipCache?: boolean;
        } = {},
    ) => {
        const taskGraph: TaskGraph = {
            dependencies: options.dependencies ?? Object.fromEntries(tasks.map((t) => [t.id, []])),
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
        const lifeCycle = options.lifeCycle ?? new EmptyLifeCycle();

        return new TaskOrchestrator({
            autoFingerprint: options.autoFingerprint,
            cache,
            lifeCycle,
            scheduler,
            skipCache: options.skipCache,
            taskExecutor: executor,
            taskHasher,
            workspaceRoot,
        });
    };

    it("should execute a simple task", async () => {
        expect.assertions(3);

        const task: Task = {
            id: "app:build",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "build" },
        };

        const executor: TaskExecutor = async () => {
            return {
                code: 0,
                terminalOutput: "Build successful",
            };
        };

        const orchestrator = createOrchestrator([task], executor);
        const results = await orchestrator.run();

        expect(results.size).toBe(1);

        const result = results.get("app:build");

        expect(result?.status).toBe("success");
        expect(result?.terminalOutput).toBe("Build successful");
    });

    it("should cache successful results", async () => {
        expect.assertions(3);

        const task: Task = {
            id: "app:build",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "build" },
        };

        let executionCount = 0;
        const executor: TaskExecutor = async () => {
            executionCount += 1;

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
        expect.assertions(1);

        const task: Task = {
            id: "app:build",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "build" },
        };

        let executionCount = 0;
        const executor: TaskExecutor = async () => {
            executionCount += 1;

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

    it("flags hadWarnings when warningPattern matches a successful run", async () => {
        expect.assertions(3);

        const task: Task = {
            id: "app:build",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "build" },
            warningPattern: [String.raw`\bwarning\b`],
        };

        const executor: TaskExecutor = async () => {
            return { code: 0, terminalOutput: "Built (1 warning)" };
        };

        const orchestrator = createOrchestrator([task], executor);
        const results = await orchestrator.run();
        const result = results.get("app:build");

        expect(result?.status).toBe("success");
        expect(result?.hadWarnings).toBe(true);

        // Default cacheOnWarning is true, so the run still seeds the cache
        const orch2 = createOrchestrator([task], executor);
        const results2 = await orch2.run();
        const result2 = results2.get("app:build");

        expect(result2?.status).toBe("local-cache");
    });

    it("does not flag hadWarnings when patterns don't match", async () => {
        expect.assertions(2);

        const task: Task = {
            id: "app:build",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "build" },
            warningPattern: [String.raw`TS\d{4}`],
        };

        const executor: TaskExecutor = async () => {
            return { code: 0, terminalOutput: "Built cleanly" };
        };

        const results = await createOrchestrator([task], executor).run();
        const result = results.get("app:build");

        expect(result?.status).toBe("success");
        expect(result?.hadWarnings).toBeUndefined();
    });

    it("skips caching warning-tainted runs when cacheOnWarning is false", async () => {
        expect.assertions(3);

        const task: Task = {
            cacheOnWarning: false,
            id: "app:build",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "build" },
            warningPattern: [String.raw`\bwarning\b`],
        };

        let executionCount = 0;
        const executor: TaskExecutor = async () => {
            executionCount += 1;

            return { code: 0, terminalOutput: "Built (1 warning)" };
        };

        const orch1 = createOrchestrator([task], executor);
        const results1 = await orch1.run();
        const result1 = results1.get("app:build");

        expect(result1?.hadWarnings).toBe(true);

        // Second run must re-execute because the first didn't seed the cache.
        const orch2 = createOrchestrator([task], executor);
        const results2 = await orch2.run();
        const result2 = results2.get("app:build");

        expect(result2?.status).toBe("success");
        expect(executionCount).toBe(2);
    });

    it("ignores invalid warningPattern regex sources without failing the task", async () => {
        expect.assertions(2);

        const task: Task = {
            id: "app:build",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "build" },
            warningPattern: ["[unclosed", String.raw`\bwarning\b`],
        };

        const executor: TaskExecutor = async () => {
            return { code: 0, terminalOutput: "Built (1 warning)" };
        };

        const results = await createOrchestrator([task], executor).run();
        const result = results.get("app:build");

        expect(result?.status).toBe("success");
        expect(result?.hadWarnings).toBe(true);
    });

    it("should skip cache when skipCache is true", async () => {
        expect.assertions(1);

        const task: Task = {
            id: "app:build",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "build" },
        };

        let executionCount = 0;
        const executor: TaskExecutor = async () => {
            executionCount += 1;

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
        expect.assertions(2);

        const task: Task = {
            id: "app:build",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "build" },
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
        expect.assertions(1);

        const task: Task = {
            id: "app:build",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "build" },
        };

        const executor: TaskExecutor = async () => {
            return {
                code: 0,
                terminalOutput: "Built with fingerprint",
            };
        };

        const orchestrator = createOrchestrator([task], executor, { autoFingerprint: true });
        const results = await orchestrator.run();
        const result = results.get("app:build");

        expect(result?.status).toBe("success");
    });

    describe("signal handling", () => {
        it("should stop processing on SIGINT", async () => {
            expect.assertions(2);

            const task1: Task = {
                id: "app:build",
                outputs: [],
                overrides: {},
                projectRoot: "packages/app",
                target: { project: "app", target: "build" },
            };

            const task2: Task = {
                id: "app:test",
                outputs: [],
                overrides: {},
                projectRoot: "packages/app",
                target: { project: "app", target: "test" },
            };

            let executionCount = 0;
            const executor: TaskExecutor = async () => {
                executionCount += 1;

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
            expect.assertions(1);

            const task: Task = {
                id: "app:build",
                outputs: [],
                overrides: {},
                projectRoot: "packages/app",
                target: { project: "app", target: "build" },
            };

            const listenerCountBefore = process.listenerCount("SIGINT");

            const orchestrator = createOrchestrator([task], successExecutor);

            await orchestrator.run();

            const listenerCountAfter = process.listenerCount("SIGINT");

            expect(listenerCountAfter).toBe(listenerCountBefore);
        });

        it("should clean up signal listeners even when tasks fail", async () => {
            expect.assertions(1);

            const task: Task = {
                id: "app:build",
                outputs: [],
                overrides: {},
                projectRoot: "packages/app",
                target: { project: "app", target: "build" },
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
            expect.assertions(2);

            const task: Task = {
                id: "app:build",
                outputs: [],
                overrides: {},
                projectRoot: "packages/app",
                target: { project: "app", target: "build" },
            };

            const lifeCycle: LifeCycleInterface = {
                endCommand: vi.fn<() => void>(),
                startCommand: vi.fn<() => void>(),
            };

            const orchestrator = createOrchestrator([task], successExecutor, { lifeCycle });

            await orchestrator.run();

            expect(lifeCycle.startCommand).toHaveBeenCalledTimes(1);
            expect(lifeCycle.endCommand).toHaveBeenCalledTimes(1);
        });

        it("should call endCommand even when task fails", async () => {
            expect.assertions(1);

            const task: Task = {
                id: "app:build",
                outputs: [],
                overrides: {},
                projectRoot: "packages/app",
                target: { project: "app", target: "build" },
            };

            const lifeCycle: LifeCycleInterface = {
                endCommand: vi.fn<() => void>(),
                startCommand: vi.fn<() => void>(),
            };

            const executor: TaskExecutor = async () => {
                throw new Error("crash");
            };

            const orchestrator = createOrchestrator([task], executor, { lifeCycle });

            await orchestrator.run();

            expect(lifeCycle.endCommand).toHaveBeenCalledTimes(1);
        });

        it("should call scheduleTask for each task", async () => {
            expect.assertions(1);

            const task: Task = {
                id: "app:build",
                outputs: [],
                overrides: {},
                projectRoot: "packages/app",
                target: { project: "app", target: "build" },
            };

            const lifeCycle: LifeCycleInterface = {
                scheduleTask: vi.fn<(task: Task) => void>(),
            };

            const orchestrator = createOrchestrator([task], successExecutor, { lifeCycle });

            await orchestrator.run();

            expect(lifeCycle.scheduleTask).toHaveBeenCalledWith(expect.objectContaining({ id: "app:build" }));
        });

        it("should call startTasks and endTasks", async () => {
            expect.assertions(2);

            const task: Task = {
                id: "app:build",
                outputs: [],
                overrides: {},
                projectRoot: "packages/app",
                target: { project: "app", target: "build" },
            };

            const lifeCycle: LifeCycleInterface = {
                endTasks: vi.fn<(taskResults: TaskResult[]) => void>(),
                startTasks: vi.fn<(tasks: Task[]) => void>(),
            };

            const orchestrator = createOrchestrator([task], successExecutor, { lifeCycle });

            await orchestrator.run();

            expect(lifeCycle.startTasks).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: "app:build" })]));
            expect(lifeCycle.endTasks).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        status: "success",
                        task: expect.objectContaining({ id: "app:build" }),
                    }),
                ]),
            );
        });

        it("should call printTaskTerminalOutput for tasks with output", async () => {
            expect.assertions(1);

            const task: Task = {
                id: "app:build",
                outputs: [],
                overrides: {},
                projectRoot: "packages/app",
                target: { project: "app", target: "build" },
            };

            const lifeCycle: LifeCycleInterface = {
                printTaskTerminalOutput: vi.fn<(task: Task, status: TaskStatus, terminalOutput: string) => void>(),
            };

            const executor: TaskExecutor = async () => {
                return {
                    code: 0,
                    terminalOutput: "Build output here",
                };
            };

            const orchestrator = createOrchestrator([task], executor, { lifeCycle });

            await orchestrator.run();

            expect(lifeCycle.printTaskTerminalOutput).toHaveBeenCalledWith(expect.objectContaining({ id: "app:build" }), "success", "Build output here");
        });

        it("should report failure status in lifecycle hooks", async () => {
            expect.assertions(1);

            const task: Task = {
                id: "app:build",
                outputs: [],
                overrides: {},
                projectRoot: "packages/app",
                target: { project: "app", target: "build" },
            };

            const lifeCycle: LifeCycleInterface = {
                endTasks: vi.fn<(taskResults: TaskResult[]) => void>(),
            };

            const executor: TaskExecutor = async () => {
                return {
                    code: 1,
                    terminalOutput: "Build failed",
                };
            };

            const orchestrator = createOrchestrator([task], executor, { lifeCycle });

            await orchestrator.run();

            expect(lifeCycle.endTasks).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        code: 1,
                        status: "failure",
                    }),
                ]),
            );
        });
    });

    describe("self-modifying tasks", () => {
        it("skips cache and reports when a task modifies its own input", async () => {
            expect.assertions(3);

            const task: Task = {
                id: "app:build",
                outputs: [],
                overrides: {},
                projectRoot: "packages/app",
                target: { project: "app", target: "build" },
            };

            const { writeFile } = await import("node:fs/promises");
            const inputFile = join(workspaceRoot, "packages/app/src/index.ts");

            const executor: TaskExecutor = async () => {
                await writeFile(inputFile, "const x = 2;");

                return { code: 0, terminalOutput: "modified-own-input" };
            };

            const printSelfModifyingSkip = vi.fn();
            const lifeCycle: LifeCycleInterface = { printSelfModifyingSkip };
            const orchestrator = createOrchestrator([task], executor, { lifeCycle });

            const results = await orchestrator.run();
            const result = results.get("app:build");

            expect(result?.selfModified).toBe(true);
            expect(printSelfModifyingSkip).toHaveBeenCalledTimes(1);

            // Second run must re-execute (the first run was not cached)
            const executor2 = vi.fn<TaskExecutor>(async () => {
                return { code: 0, terminalOutput: "second" };
            });
            const orch2 = createOrchestrator([task], executor2);

            await orch2.run();

            expect(executor2).toHaveBeenCalledTimes(1);
        });

        it("does not flag tasks that leave their inputs untouched", async () => {
            expect.assertions(2);

            const task: Task = {
                id: "app:build",
                outputs: [],
                overrides: {},
                projectRoot: "packages/app",
                target: { project: "app", target: "build" },
            };

            const printSelfModifyingSkip = vi.fn();
            const lifeCycle: LifeCycleInterface = { printSelfModifyingSkip };
            const orchestrator = createOrchestrator([task], successExecutor, { lifeCycle });

            const results = await orchestrator.run();
            const result = results.get("app:build");

            expect(result?.selfModified).toBeUndefined();
            expect(printSelfModifyingSkip).not.toHaveBeenCalled();
        });
    });

    describe("empty-fingerprint safety net", () => {
        it("skips cache and warns when auto-fingerprint tracking finds no workspace accesses", async () => {
            expect.assertions(3);

            const task: Task = {
                id: "app:build",
                outputs: [],
                overrides: {},
                projectRoot: "packages/app",
                target: { project: "app", target: "build" },
            };

            const cache = new Cache({ workspaceRoot });
            const taskHasher = new InProcessTaskHasher({
                projects: { app: { root: "packages/app" } },
                workspaceRoot,
            });

            // Stub the hasher to return zero file nodes, mirroring the
            // tracker-came-back-empty signal for a static binary on a
            // platform without strace. The orchestrator constructs a
            // real TrackedTaskExecutor internally; `resolveCommand`
            // forces the auto-fingerprint "real tracker" branch, and
            // `echo` is a shell builtin the Node preload can't attach to.
            const taskGraph: TaskGraph = {
                dependencies: { "app:build": [] },
                roots: ["app:build"],
                tasks: { "app:build": task },
            };
            const projectGraph: ProjectGraph = {
                dependencies: { app: [] },
                nodes: { app: { data: { root: "packages/app" }, name: "app", type: "application" } },
            };
            const scheduler = new TaskScheduler(taskGraph, projectGraph, 3);

            const printEmptyFingerprintWarning = vi.fn();
            const executor: TaskExecutor = async () => {
                return { code: 0, terminalOutput: "ran" };
            };

            const orchestrator = new TaskOrchestrator({
                autoFingerprint: true,
                cache,
                lifeCycle: { printEmptyFingerprintWarning },
                resolveCommand: () => "echo hello",
                scheduler,
                taskExecutor: executor,
                taskGraph,
                taskHasher,
                workspaceRoot,
            });

            const results = await orchestrator.run();
            const result = results.get("app:build");

            expect(result?.emptyFingerprint).toBe(true);
            expect(printEmptyFingerprintWarning).toHaveBeenCalledTimes(1);

            // Nothing was persisted to the cache — the task-id index must
            // not resolve, so subsequent runs have no shortcut to hit.
            const cached = await cache.getByTaskId("app:build");

            expect(cached).toBeUndefined();
        });
    });
});
