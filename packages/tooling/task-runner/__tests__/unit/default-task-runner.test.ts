import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { defaultTaskRunner } from "../../src/default-task-runner";
import { EmptyLifeCycle } from "../../src/life-cycle";
import type { LifeCycleInterface, ProjectGraph, Task, TaskExecutor, TaskGraph, TaskRunnerContext, TaskRunnerOptions } from "../../src/types";

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `runner-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

const createContext = (workspaceRoot: string, tasks: Task[], executor: TaskExecutor, lifeCycle?: LifeCycleInterface): TaskRunnerContext => {
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

    return {
        lifeCycle: lifeCycle ?? new EmptyLifeCycle(),
        projectGraph,
        taskExecutor: executor,
        taskGraph,
        workspaceRoot,
    };
};

const makeTask = (id = "app:build"): Task => {
    return {
        id,
        outputs: [],
        overrides: {},
        projectRoot: "packages/app",
        target: {
            project: id.split(":")[0] as string,
            target: id.split(":")[1] as string,
        },
    };
};

const createCountingExecutor = (): { executor: TaskExecutor; getCount: () => number } => {
    let executionCount = 0;

    return {
        executor: async () => {
            executionCount += 1;

            return { code: 0, terminalOutput: "Built" };
        },
        getCount: () => executionCount,
    };
};

const createSimpleExecutor = (): TaskExecutor => async () => {
    return {
        code: 0,
        terminalOutput: "Built",
    };
};

describe(defaultTaskRunner, () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();

        await mkdir(join(workspaceRoot, "packages/app/src"), { recursive: true });
        await writeFile(join(workspaceRoot, "packages/app/src/index.ts"), "const x = 1;");
        await writeFile(join(workspaceRoot, "packages/app/package.json"), JSON.stringify({ dependencies: { lodash: "^4.17.0" }, name: "app" }));
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });

        // Clean up env vars that tests may set
        delete process.env["NEXT_PUBLIC_E2E_TEST_URL"];
    });

    it("should execute and cache tasks end-to-end", async () => {
        expect.assertions(4);

        const task = makeTask();
        const { executor, getCount } = createCountingExecutor();

        const context = createContext(workspaceRoot, [task], executor);

        // First run
        const results1 = await defaultTaskRunner([task], {}, context);

        expect(results1.get("app:build")?.status).toBe("success");
        expect(getCount()).toBe(1);

        // Second run — should hit cache
        const results2 = await defaultTaskRunner([task], {}, context);

        expect(results2.get("app:build")?.status).toBe("local-cache");
        expect(getCount()).toBe(1);
    });

    it("should support dry-run mode", async () => {
        expect.assertions(2);

        const task = makeTask();
        const executor: TaskExecutor = async () => {
            throw new Error("Should not execute in dry-run");
        };

        const context = createContext(workspaceRoot, [task], executor);
        const results = await defaultTaskRunner([task], { dryRun: true }, context);
        const result = results.get("app:build");

        expect(result?.status).toBe("skipped");
        expect(result?.terminalOutput).toContain("DRY RUN");
    });

    // eslint-disable-next-line no-secrets/no-secrets
    it("should support smartLockfileHashing", async () => {
        expect.assertions(3);

        const task = makeTask();

        // Create npm lockfile
        await writeFile(
            join(workspaceRoot, "package-lock.json"),
            JSON.stringify({
                lockfileVersion: 3,
                packages: {
                    "node_modules/lodash": { version: "4.17.21" },
                },
            }),
        );

        const { executor, getCount } = createCountingExecutor();

        const context = createContext(workspaceRoot, [task], executor);
        const options: TaskRunnerOptions = { smartLockfileHashing: true };

        // Run once
        await defaultTaskRunner([task], options, context);

        expect(getCount()).toBe(1);

        // Run again — should cache hit (lockfile hasn't changed)
        const results2 = await defaultTaskRunner([task], options, context);

        expect(results2.get("app:build")?.status).toBe("local-cache");
        expect(getCount()).toBe(1);
    });

    it("should support frameworkInference", async () => {
        expect.assertions(3);

        const task = makeTask();

        // Make it a Next.js project
        await writeFile(
            join(workspaceRoot, "packages/app/package.json"),
            JSON.stringify({
                dependencies: { next: "14.0.0", react: "18.2.0" },
                name: "app",
            }),
        );

        process.env["NEXT_PUBLIC_E2E_TEST_URL"] = "http://localhost:3000";

        const { executor, getCount } = createCountingExecutor();

        const context = createContext(workspaceRoot, [task], executor);

        // First run
        await defaultTaskRunner([task], { frameworkInference: true }, context);

        expect(getCount()).toBe(1);

        // Change the framework env var — should bust cache
        process.env["NEXT_PUBLIC_E2E_TEST_URL"] = "http://localhost:4000";

        const results2 = await defaultTaskRunner([task], { frameworkInference: true }, context);

        expect(results2.get("app:build")?.status).toBe("success");
        expect(getCount()).toBe(2);

        delete process.env["NEXT_PUBLIC_E2E_TEST_URL"];
    });

    it("should generate summary when summarize is enabled", async () => {
        expect.assertions(8);

        const task = makeTask();
        const executor = createSimpleExecutor();

        const context = createContext(workspaceRoot, [task], executor);

        await defaultTaskRunner([task], { summarize: true }, context);

        // Check that a summary file was written
        const runsDirectory = join(workspaceRoot, ".task-runner", "runs");
        const files = await readdir(runsDirectory);

        expect(files).toHaveLength(1);
        expect(files[0]).toMatch(/\.json$/);

        // Verify the summary content
        const content = await readFile(join(runsDirectory, files[0] as string), "utf8");
        const summary = JSON.parse(content);

        expect(summary.tasks).toHaveLength(1);
        expect(summary.tasks[0].taskId).toBe("app:build");
        expect(summary.tasks[0].cacheStatus).toBe("MISS");
        expect(summary.stats.total).toBe(1);
        expect(summary.stats.succeeded).toBe(1);
        expect(summary.environment.nodeVersion).toBe(process.version);
    });

    it("should invoke cacheDiagnostics lifecycle hook on miss", async () => {
        expect.assertions(2);

        const task = makeTask();
        const executor = createSimpleExecutor();

        const cacheMissMessages: string[] = [];
        const lifeCycle: LifeCycleInterface = {
            printCacheMiss: (_task, reasons) => {
                cacheMissMessages.push(reasons);
            },
        };

        const context = createContext(workspaceRoot, [task], executor, lifeCycle);

        await defaultTaskRunner([task], { autoFingerprint: true, cacheDiagnostics: true }, context);

        // On first run with auto-fingerprint, there's no previous fingerprint
        expect(cacheMissMessages).toHaveLength(1);
        expect(cacheMissMessages[0]).toContain("No previous fingerprint found");
    });

    it("should skip cache when skipNxCache is true", async () => {
        expect.assertions(2);

        const task = makeTask();
        const { executor, getCount } = createCountingExecutor();

        const context = createContext(workspaceRoot, [task], executor);

        await defaultTaskRunner([task], {}, context);

        expect(getCount()).toBe(1);

        // Second run with skipNxCache should execute again
        await defaultTaskRunner([task], { skipNxCache: true }, context);

        expect(getCount()).toBe(2);
    });
});
