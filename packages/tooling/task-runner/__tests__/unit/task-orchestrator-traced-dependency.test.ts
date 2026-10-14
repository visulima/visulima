import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Cache } from "../../src/cache";
import { EmptyLifeCycle } from "../../src/life-cycle";
import { InProcessTaskHasher } from "../../src/task-hasher";
import { TaskOrchestrator } from "../../src/task-orchestrator";
import { TaskScheduler } from "../../src/task-scheduler";
import type { ProjectGraph, Task, TaskExecutor, TaskGraph, TaskResult } from "../../src/types";

const generate: Task = {
    cache: true,
    hashMode: "trace",
    id: "lib:generate",
    outputs: [],
    overrides: {},
    projectRoot: "packages/lib",
    target: { project: "lib", target: "generate" },
};

const consume: Task = {
    cache: true,
    id: "app:consume",
    outputs: [],
    overrides: {},
    projectRoot: "packages/app",
    target: { project: "app", target: "consume" },
};

describe("a declared task that depends on a traced task", () => {
    let workspaceRoot: string;
    let executed: string[];

    // A fresh orchestrator per run, as every `vis run` invocation is: only the on-disk cache carries over.
    const run = async (): Promise<Map<string, TaskResult>> => {
        const tasks = [{ ...generate }, { ...consume }];
        const taskGraph: TaskGraph = {
            dependencies: { "app:consume": ["lib:generate"], "lib:generate": [] },
            roots: ["lib:generate"],
            tasks: Object.fromEntries(tasks.map((task) => [task.id, task])),
        };
        const projectGraph: ProjectGraph = {
            dependencies: { app: ["lib"], lib: [] },
            nodes: {
                app: { data: { root: "packages/app" }, name: "app", type: "application" },
                lib: { data: { root: "packages/lib" }, name: "lib", type: "library" },
            },
        };
        const executor: TaskExecutor = async (task) => {
            executed.push(task.id);

            // What the task "built", so a stale cache hit is visible in the output it serves.
            return { code: 0, terminalOutput: await readFile(join(workspaceRoot, "packages/lib/src/a.ts"), "utf8") };
        };

        return new TaskOrchestrator({
            cache: new Cache({ workspaceRoot }),
            lifeCycle: new EmptyLifeCycle(),
            scheduler: new TaskScheduler(taskGraph, projectGraph, 3),
            taskExecutor: executor,
            taskGraph,
            taskHasher: new InProcessTaskHasher({
                projects: { app: { root: "packages/app" }, lib: { root: "packages/lib" } },
                workspaceRoot,
            }),
            workspaceRoot,
        }).run();
    };

    const executedOnRun = async (): Promise<string[]> => {
        executed = [];

        await run();

        return executed;
    };

    beforeEach(async () => {
        // eslint-disable-next-line sonarjs/pseudo-random
        workspaceRoot = join(tmpdir(), `orch-traced-dep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

        await mkdir(join(workspaceRoot, "packages/lib/src"), { recursive: true });
        await mkdir(join(workspaceRoot, "packages/app/src"), { recursive: true });
        await writeFile(join(workspaceRoot, "packages/lib/src/a.ts"), "export const a = 1;");
        await writeFile(join(workspaceRoot, "packages/app/src/b.ts"), "export const b = 1;");
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    it("is a cache hit whenever the traced dependency is, and re-runs when it does", async () => {
        expect.assertions(4);

        // Cold: both run.
        await expect(executedOnRun()).resolves.toStrictEqual(["lib:generate", "app:consume"]);

        // Warm: the traced dependency hits, so the dependent must hit as well.
        await expect(executedOnRun()).resolves.toStrictEqual([]);

        // Only the dependency's input changes: it re-runs, so the dependent must follow it.
        await writeFile(join(workspaceRoot, "packages/lib/src/a.ts"), "export const a = 2;");

        await expect(executedOnRun()).resolves.toStrictEqual(["lib:generate", "app:consume"]);

        // Warm again: nothing changed since the previous run.
        await expect(executedOnRun()).resolves.toStrictEqual([]);
    });

    it("never serves a dependent's output computed against an older dependency state", async () => {
        expect.assertions(1);

        await run();
        // Warm run: the dependency hits.
        await run();

        await writeFile(join(workspaceRoot, "packages/lib/src/a.ts"), "export const a = 2;");
        await run();

        // The dependency hits again and the dependent must serve what was built from `a = 2`.
        const results = await run();

        expect(results.get("app:consume")?.terminalOutput).toBe("export const a = 2;");
    });
});
