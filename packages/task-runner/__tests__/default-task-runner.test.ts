import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { defaultTaskRunner } from "../src/default-task-runner";
import { EmptyLifeCycle } from "../src/life-cycle";
import type {
    Task,
    TaskGraph,
    ProjectGraph,
    TaskRunnerContext,
    TaskRunnerOptions,
    TaskExecutor,
    LifeCycleInterface,
} from "../src/types";

const createTmpDir = async (): Promise<string> => {
    const dir = join(tmpdir(), `runner-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(dir, { recursive: true });

    return dir;
};

const createContext = (
    workspaceRoot: string,
    tasks: Task[],
    executor: TaskExecutor,
    lifeCycle?: LifeCycleInterface,
): TaskRunnerContext => {
    const taskGraph: TaskGraph = {
        roots: tasks.map((t) => t.id),
        tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
        dependencies: Object.fromEntries(tasks.map((t) => [t.id, []])),
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

    return {
        taskGraph,
        projectGraph,
        lifeCycle: lifeCycle ?? new EmptyLifeCycle(),
        taskExecutor: executor,
        workspaceRoot,
    };
};

const makeTask = (id = "app:build"): Task => ({
    id,
    target: {
        project: id.split(":")[0] as string,
        target: id.split(":")[1] as string,
    },
    overrides: {},
    outputs: [],
    projectRoot: "packages/app",
});

describe("defaultTaskRunner", () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTmpDir();

        await mkdir(join(workspaceRoot, "packages/app/src"), { recursive: true });
        await writeFile(join(workspaceRoot, "packages/app/src/index.ts"), "const x = 1;");
        await writeFile(
            join(workspaceRoot, "packages/app/package.json"),
            JSON.stringify({ name: "app", dependencies: { lodash: "^4.17.0" } }),
        );
    });

    afterEach(async () => {
        await rm(workspaceRoot, { recursive: true, force: true });
    });

    it("should execute and cache tasks end-to-end", async () => {
        const task = makeTask();

        let executionCount = 0;
        const executor: TaskExecutor = async () => {
            executionCount++;
            return { code: 0, terminalOutput: "Built" };
        };

        const context = createContext(workspaceRoot, [task], executor);

        // First run
        const results1 = await defaultTaskRunner([task], {}, context);

        expect(results1.get("app:build")?.status).toBe("success");
        expect(executionCount).toBe(1);

        // Second run — should hit cache
        const results2 = await defaultTaskRunner([task], {}, context);

        expect(results2.get("app:build")?.status).toBe("local-cache");
        expect(executionCount).toBe(1);
    });

    it("should support dry-run mode", async () => {
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

    it("should support smartLockfileHashing", async () => {
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

        let executionCount = 0;
        const executor: TaskExecutor = async () => {
            executionCount++;
            return { code: 0, terminalOutput: "Built" };
        };

        const context = createContext(workspaceRoot, [task], executor);
        const options: TaskRunnerOptions = { smartLockfileHashing: true };

        // Run once
        await defaultTaskRunner([task], options, context);
        expect(executionCount).toBe(1);

        // Run again — should cache hit (lockfile hasn't changed)
        const results2 = await defaultTaskRunner([task], options, context);

        expect(results2.get("app:build")?.status).toBe("local-cache");
        expect(executionCount).toBe(1);
    });

    it("should support frameworkInference", async () => {
        const task = makeTask();

        // Make it a Next.js project
        await writeFile(
            join(workspaceRoot, "packages/app/package.json"),
            JSON.stringify({
                name: "app",
                dependencies: { next: "14.0.0", react: "18.2.0" },
            }),
        );

        process.env["NEXT_PUBLIC_E2E_TEST_URL"] = "http://localhost:3000";

        let executionCount = 0;
        const executor: TaskExecutor = async () => {
            executionCount++;
            return { code: 0, terminalOutput: "Built" };
        };

        const context = createContext(workspaceRoot, [task], executor);

        // First run
        await defaultTaskRunner([task], { frameworkInference: true }, context);
        expect(executionCount).toBe(1);

        // Change the framework env var — should bust cache
        process.env["NEXT_PUBLIC_E2E_TEST_URL"] = "http://localhost:4000";

        const results2 = await defaultTaskRunner([task], { frameworkInference: true }, context);

        expect(results2.get("app:build")?.status).toBe("success");
        expect(executionCount).toBe(2);

        delete process.env["NEXT_PUBLIC_E2E_TEST_URL"];
    });

    it("should generate summary when summarize is enabled", async () => {
        const task = makeTask();
        const executor: TaskExecutor = async () => ({
            code: 0,
            terminalOutput: "Built",
        });

        const context = createContext(workspaceRoot, [task], executor);
        await defaultTaskRunner([task], { summarize: true }, context);

        // Check that a summary file was written
        const runsDir = join(workspaceRoot, ".task-runner", "runs");
        const files = await readdir(runsDir);

        expect(files.length).toBe(1);
        expect(files[0]).toMatch(/\.json$/);

        // Verify the summary content
        const content = await readFile(join(runsDir, files[0] as string), "utf-8");
        const summary = JSON.parse(content);

        expect(summary.tasks).toHaveLength(1);
        expect(summary.tasks[0].taskId).toBe("app:build");
        expect(summary.tasks[0].cacheStatus).toBe("MISS");
        expect(summary.stats.total).toBe(1);
        expect(summary.stats.succeeded).toBe(1);
        expect(summary.environment.nodeVersion).toBe(process.version);
    });

    it("should invoke cacheDiagnostics lifecycle hook on miss", async () => {
        const task = makeTask();
        const executor: TaskExecutor = async () => ({
            code: 0,
            terminalOutput: "Built",
        });

        const cacheMissMessages: string[] = [];
        const lifeCycle: LifeCycleInterface = {
            printCacheMiss: (_task, reasons) => {
                cacheMissMessages.push(reasons);
            },
        };

        const context = createContext(workspaceRoot, [task], executor, lifeCycle);

        await defaultTaskRunner(
            [task],
            { autoFingerprint: true, cacheDiagnostics: true },
            context,
        );

        // On first run with auto-fingerprint, there's no previous fingerprint
        expect(cacheMissMessages.length).toBe(1);
        expect(cacheMissMessages[0]).toContain("No previous fingerprint found");
    });

    it("should skip cache when skipNxCache is true", async () => {
        const task = makeTask();

        let executionCount = 0;
        const executor: TaskExecutor = async () => {
            executionCount++;
            return { code: 0, terminalOutput: "Built" };
        };

        const context = createContext(workspaceRoot, [task], executor);

        await defaultTaskRunner([task], {}, context);
        expect(executionCount).toBe(1);

        // Second run with skipNxCache should execute again
        await defaultTaskRunner([task], { skipNxCache: true }, context);
        expect(executionCount).toBe(2);
    });
});
