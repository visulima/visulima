import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { Cache } from "../../src/cache";
import { EmptyLifeCycle } from "../../src/life-cycle";
import { InProcessTaskHasher } from "../../src/task-hasher";
import { TaskOrchestrator } from "../../src/task-orchestrator";
import { TaskScheduler } from "../../src/task-scheduler";
import type { ProjectGraph, Task, TaskExecutor, TaskGraph } from "../../src/types";

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `orch-deadlock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

const makeTask = (project: string): Task => {
    return {
        id: `${project}:build`,
        outputs: [],
        overrides: {},
        projectRoot: `packages/${project}`,
        target: { project, target: "build" },
    };
};

describe("orphan-dep tolerance + deadlock diagnostics", () => {
    it("schedules every task even when dependency lists carry refs to non-existent task ids", async () => {
        // Asserts once per scheduled task across the orphan-dep fixture set.
        expect.assertions(27);

        const workspaceRoot = await createTemporaryDirectory();

        try {
            await mkdir(join(workspaceRoot, "packages/app/src"), { recursive: true });

            const leaves = Array.from({ length: 13 }, (_, index) => `leaf${index}`);
            const dependents = Array.from({ length: 11 }, (_, index) => `dep${index}`);
            const projects = [...leaves, ...dependents];

            const tasks = projects.map((p) => makeTask(p));

            const dependencies: Record<string, string[]> = {};

            for (const leaf of leaves) {
                dependencies[`${leaf}:build`] = [];
            }

            for (const dep of dependents) {
                // Each dependent depends on 2 leaves PLUS an orphan id —
                // mirroring the cirrus-side input bug. Pre-fix this
                // deadlocks; post-fix it schedules all 24 tasks.
                const index = Number(dep.replace("dep", ""));

                dependencies[`${dep}:build`] = [`leaf${index % 13}:build`, `leaf${(index + 1) % 13}:build`, "orphan:build"];
            }

            const taskGraph: TaskGraph = {
                dependencies,
                roots: leaves.map((l) => `${l}:build`),
                tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
            };

            const projectGraph: ProjectGraph = {
                dependencies: Object.fromEntries(projects.map((p) => [p, []])),
                nodes: Object.fromEntries(
                    projects.map((p) => [
                        p,
                        {
                            data: { root: `packages/${p}` },
                            name: p,
                            type: "application",
                        },
                    ]),
                ),
            };

            const cache = new Cache({ workspaceRoot });
            const taskHasher = new InProcessTaskHasher({
                projects: Object.fromEntries(projects.map((p) => [p, { root: `packages/${p}` }])),
                workspaceRoot,
            });
            const scheduler = new TaskScheduler(taskGraph, projectGraph, 1);
            const executor: TaskExecutor = async () => {
                return { code: 0, terminalOutput: "ok" };
            };

            const orchestrator = new TaskOrchestrator({
                cache,
                lifeCycle: new EmptyLifeCycle(),
                scheduler,
                skipCache: true,
                taskExecutor: executor,
                taskGraph,
                taskHasher,
                workspaceRoot,
            });

            let warningOutput = "";
            const originalWrite = process.stderr.write.bind(process.stderr);

            process.stderr.write = (chunk: string | Uint8Array) => {
                warningOutput += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();

                return true;
            };

            try {
                const results = await orchestrator.run();

                expect(results.size).toBe(24);

                for (const t of tasks) {
                    expect(results.get(t.id)?.status).toBe("success");
                }

                expect(warningOutput).toContain("dependency refs that don't resolve");
                expect(warningOutput).toContain("orphan:build");
            } finally {
                process.stderr.write = originalWrite;
            }
        } finally {
            await rm(workspaceRoot, { force: true, recursive: true });
        }
    });

    it("surfaces a clearer deadlock error that names the stranded tasks on a true cycle", async () => {
        expect.assertions(2);

        const workspaceRoot = await createTemporaryDirectory();

        try {
            await mkdir(join(workspaceRoot, "packages/app/src"), { recursive: true });

            const tasks = [makeTask("a"), makeTask("b")];
            const taskGraph: TaskGraph = {
                dependencies: { "a:build": ["b:build"], "b:build": ["a:build"] },
                roots: [],
                tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
            };

            const projectGraph: ProjectGraph = {
                dependencies: { a: [], b: [] },
                nodes: {
                    a: { data: { root: "packages/a" }, name: "a", type: "application" },
                    b: { data: { root: "packages/b" }, name: "b", type: "application" },
                },
            };

            const cache = new Cache({ workspaceRoot });
            const taskHasher = new InProcessTaskHasher({
                projects: { a: { root: "packages/a" }, b: { root: "packages/b" } },
                workspaceRoot,
            });
            const scheduler = new TaskScheduler(taskGraph, projectGraph, 2);
            const executor: TaskExecutor = async () => {
                return { code: 0, terminalOutput: "ok" };
            };

            const orchestrator = new TaskOrchestrator({
                cache,
                lifeCycle: new EmptyLifeCycle(),
                scheduler,
                skipCache: true,
                taskExecutor: executor,
                taskGraph,
                taskHasher,
                workspaceRoot,
            });

            await expect(orchestrator.run()).rejects.toThrow(/Circular dependency found/);
            await expect(
                new TaskOrchestrator({
                    cache,
                    lifeCycle: new EmptyLifeCycle(),
                    scheduler: new TaskScheduler(taskGraph, projectGraph, 2),
                    skipCache: true,
                    taskExecutor: executor,
                    taskGraph,
                    taskHasher,
                    workspaceRoot,
                }).run(),
            ).rejects.toThrow(/Stranded tasks/);
        } finally {
            await rm(workspaceRoot, { force: true, recursive: true });
        }
    });
});

describe("skip-dependents on failure (Fix #1)", () => {
    it("marks transitive dependents skipped when an upstream task fails, but runs independent tasks", async () => {
        expect.assertions(5);

        const workspaceRoot = await createTemporaryDirectory();

        try {
            // Graph: a → b → c (linear), d standalone.
            // b fails. Expect: a=success, b=failure, c=skipped, d=success.
            const tasks = [makeTask("a"), makeTask("b"), makeTask("c"), makeTask("d")];
            const taskGraph: TaskGraph = {
                dependencies: {
                    "a:build": [],
                    "b:build": ["a:build"],
                    "c:build": ["b:build"],
                    "d:build": [],
                },
                roots: ["a:build", "d:build"],
                tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
            };
            const projectGraph: ProjectGraph = {
                dependencies: { a: [], b: [], c: [], d: [] },
                nodes: Object.fromEntries(
                    ["a", "b", "c", "d"].map((p) => [
                        p,
                        {
                            data: { root: `packages/${p}` },
                            name: p,
                            type: "application",
                        },
                    ]),
                ),
            };

            const cache = new Cache({ workspaceRoot });
            const taskHasher = new InProcessTaskHasher({
                projects: Object.fromEntries(["a", "b", "c", "d"].map((p) => [p, { root: `packages/${p}` }])),
                workspaceRoot,
            });
            const scheduler = new TaskScheduler(taskGraph, projectGraph, 4);

            const executor: TaskExecutor = async (task) => (task.id === "b:build" ? { code: 1, terminalOutput: "b broke" } : { code: 0, terminalOutput: "ok" });

            const orchestrator = new TaskOrchestrator({
                cache,
                lifeCycle: new EmptyLifeCycle(),
                scheduler,
                skipCache: true,
                taskExecutor: executor,
                taskGraph,
                taskHasher,
                workspaceRoot,
            });

            const results = await orchestrator.run();

            expect(results.get("a:build")?.status).toBe("success");
            expect(results.get("b:build")?.status).toBe("failure");
            expect(results.get("c:build")?.status).toBe("skipped");
            expect(results.get("c:build")?.terminalOutput).toContain("upstream dependency failed (b:build)");
            expect(results.get("d:build")?.status).toBe("success");
        } finally {
            await rm(workspaceRoot, { force: true, recursive: true });
        }
    });

    it("with bail=true, marks every remaining task skipped on first failure", async () => {
        expect.assertions(4);

        const workspaceRoot = await createTemporaryDirectory();

        try {
            // c and d are independent leaves. b fails; under bail, c & d
            // should be skipped even though they don't depend on b.
            const tasks = [makeTask("a"), makeTask("b"), makeTask("c"), makeTask("d")];
            const taskGraph: TaskGraph = {
                dependencies: {
                    "a:build": [],
                    "b:build": ["a:build"],
                    "c:build": [],
                    "d:build": [],
                },
                roots: ["a:build", "c:build", "d:build"],
                tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
            };
            const projectGraph: ProjectGraph = {
                dependencies: { a: [], b: [], c: [], d: [] },
                nodes: Object.fromEntries(
                    ["a", "b", "c", "d"].map((p) => [
                        p,
                        {
                            data: { root: `packages/${p}` },
                            name: p,
                            type: "application",
                        },
                    ]),
                ),
            };

            const cache = new Cache({ workspaceRoot });
            const taskHasher = new InProcessTaskHasher({
                projects: Object.fromEntries(["a", "b", "c", "d"].map((p) => [p, { root: `packages/${p}` }])),
                workspaceRoot,
            });
            // parallel=1 so a→b runs before c/d get a chance.
            const scheduler = new TaskScheduler(taskGraph, projectGraph, 1);

            const executor: TaskExecutor = async (task) => (task.id === "b:build" ? { code: 1, terminalOutput: "b broke" } : { code: 0, terminalOutput: "ok" });

            const orchestrator = new TaskOrchestrator({
                bail: true,
                cache,
                lifeCycle: new EmptyLifeCycle(),
                scheduler,
                skipCache: true,
                taskExecutor: executor,
                taskGraph,
                taskHasher,
                workspaceRoot,
            });

            const results = await orchestrator.run();

            expect(results.get("a:build")?.status).toBe("success");
            expect(results.get("b:build")?.status).toBe("failure");
            expect(results.get("c:build")?.status).toBe("skipped");
            expect(results.get("d:build")?.status).toBe("skipped");
        } finally {
            await rm(workspaceRoot, { force: true, recursive: true });
        }
    });
});

describe("lifecycle hook resilience (Fix #2)", () => {
    it("a throwing endTasks hook does not hang the loop or crash the run", async () => {
        expect.assertions(3);

        const workspaceRoot = await createTemporaryDirectory();

        try {
            const tasks = [makeTask("a"), makeTask("b")];
            const taskGraph: TaskGraph = {
                dependencies: { "a:build": [], "b:build": [] },
                roots: ["a:build", "b:build"],
                tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
            };
            const projectGraph: ProjectGraph = {
                dependencies: { a: [], b: [] },
                nodes: {
                    a: { data: { root: "packages/a" }, name: "a", type: "application" },
                    b: { data: { root: "packages/b" }, name: "b", type: "application" },
                },
            };

            const cache = new Cache({ workspaceRoot });
            const taskHasher = new InProcessTaskHasher({
                projects: { a: { root: "packages/a" }, b: { root: "packages/b" } },
                workspaceRoot,
            });
            const scheduler = new TaskScheduler(taskGraph, projectGraph, 1);

            const executor: TaskExecutor = async () => {
                return { code: 0, terminalOutput: "ok" };
            };

            const buggyLifeCycle = {
                endTasks: (): void => {
                    throw new Error("plugin bug");
                },
            };

            const orchestrator = new TaskOrchestrator({
                cache,
                lifeCycle: buggyLifeCycle,
                scheduler,
                skipCache: true,
                taskExecutor: executor,
                taskGraph,
                taskHasher,
                workspaceRoot,
            });

            const results = await Promise.race([
                orchestrator.run(),
                new Promise<never>((_, reject) => {
                    setTimeout(() => {
                        reject(new Error("orchestrator hung"));
                    }, 5000);
                }),
            ]);

            expect(results.size).toBe(2);
            expect(results.get("a:build")?.status).toBe("success");
            expect(results.get("b:build")?.status).toBe("success");
        } finally {
            await rm(workspaceRoot, { force: true, recursive: true });
        }
    });
});

describe("parallelism: false (Fix #4)", () => {
    it("a task with parallelism=false never runs alongside siblings", async () => {
        expect.assertions(2);

        const workspaceRoot = await createTemporaryDirectory();

        try {
            const tasks: Task[] = [{ ...makeTask("a") }, { ...makeTask("b"), parallelism: false }, { ...makeTask("c") }];
            const taskGraph: TaskGraph = {
                dependencies: { "a:build": [], "b:build": [], "c:build": [] },
                roots: ["a:build", "b:build", "c:build"],
                tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
            };
            const projectGraph: ProjectGraph = {
                dependencies: { a: [], b: [], c: [] },
                nodes: Object.fromEntries(
                    ["a", "b", "c"].map((p) => [
                        p,
                        {
                            data: { root: `packages/${p}` },
                            name: p,
                            type: "application",
                        },
                    ]),
                ),
            };

            const cache = new Cache({ workspaceRoot });
            const taskHasher = new InProcessTaskHasher({
                projects: Object.fromEntries(["a", "b", "c"].map((p) => [p, { root: `packages/${p}` }])),
                workspaceRoot,
            });
            // maxParallel=4 so without the parallelism gate, all 3 would
            // run together and observedRunning would peak at 3.
            const scheduler = new TaskScheduler(taskGraph, projectGraph, 4);

            let running = 0;
            let maxRunningWhenSoloPresent = 0;

            const executor: TaskExecutor = async (task) => {
                running += 1;

                if (task.id === "b:build") {
                    maxRunningWhenSoloPresent = Math.max(maxRunningWhenSoloPresent, running);
                }

                await new Promise((resolve) => {
                    setTimeout(resolve, 20);
                });
                running -= 1;

                return { code: 0, terminalOutput: "ok" };
            };

            const orchestrator = new TaskOrchestrator({
                cache,
                lifeCycle: new EmptyLifeCycle(),
                scheduler,
                skipCache: true,
                taskExecutor: executor,
                taskGraph,
                taskHasher,
                workspaceRoot,
            });

            const results = await orchestrator.run();

            expect(results.size).toBe(3);
            // b ran alone — at the instant b was in flight, no sibling
            // was concurrent with it.
            expect(maxRunningWhenSoloPresent).toBe(1);
        } finally {
            await rm(workspaceRoot, { force: true, recursive: true });
        }
    });
});
