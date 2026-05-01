import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { RunSummary } from "../../src/run-summary";
import { generateRunSummary, getLastRunSummaryPath, readLastRunSummary, writeLastRunSummary, writeRunSummary } from "../../src/run-summary";
import type { Task, TaskGraph, TaskResult, TaskResults } from "../../src/types";

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `summary-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

const createTask = (id: string, overrides: Partial<Task> = {}): Task => {
    return {
        id,
        outputs: [],
        overrides: {},
        target: {
            project: id.split(":")[0] as string,
            target: id.split(":")[1] as string,
        },
        ...overrides,
    };
};

const createResult = (task: Task, status: TaskResult["status"], overrides: Partial<TaskResult> = {}): TaskResult => {
    return {
        code: status === "failure" ? 1 : 0,
        endTime: Date.now(),
        startTime: Date.now() - 1000,
        status,
        task,
        terminalOutput: `Output of ${task.id}`,
        ...overrides,
    };
};

describe(generateRunSummary, () => {
    it("should generate a complete summary from task results", () => {
        expect.assertions(10);

        const taskA = createTask("app:build", { hash: "abc123" });
        const taskB = createTask("lib:build", { hash: "def456" });

        const results: TaskResults = new Map([
            ["app:build", createResult(taskA, "success")],
            ["lib:build", createResult(taskB, "local-cache")],
        ]);

        const taskGraph: TaskGraph = {
            dependencies: { "app:build": ["lib:build"], "lib:build": [] },
            roots: ["lib:build"],
            tasks: { "app:build": taskA, "lib:build": taskB },
        };

        const startTime = Date.now() - 5000;
        const summary = generateRunSummary(results, taskGraph, startTime);

        expect(summary.id).toBeDefined();
        expect(summary.startTime).toBeDefined();
        expect(summary.endTime).toBeDefined();
        expect(summary.duration).toBeGreaterThan(0);
        expect(summary.tasks).toHaveLength(2);
        expect(summary.stats.total).toBe(2);
        expect(summary.stats.succeeded).toBe(1);
        expect(summary.stats.cached).toBe(1);
        expect(summary.stats.failed).toBe(0);
        expect(summary.stats.skipped).toBe(0);
    });

    it("should track correct cache status", () => {
        expect.assertions(7);

        const taskA = createTask("app:build");
        const taskB = createTask("lib:build");
        const taskC = createTask("api:build");
        const taskD = createTask("web:build");

        const results: TaskResults = new Map([
            ["api:build", createResult(taskC, "remote-cache")],
            ["app:build", createResult(taskA, "success")],
            ["lib:build", createResult(taskB, "local-cache")],
            ["web:build", createResult(taskD, "failure")],
        ]);

        const taskGraph: TaskGraph = {
            dependencies: {
                "api:build": [],
                "app:build": [],
                "lib:build": [],
                "web:build": [],
            },
            roots: ["app:build", "lib:build", "api:build", "web:build"],
            tasks: {
                "api:build": taskC,
                "app:build": taskA,
                "lib:build": taskB,
                "web:build": taskD,
            },
        };

        const summary = generateRunSummary(results, taskGraph, Date.now());

        expect(summary.stats.succeeded).toBe(1);
        expect(summary.stats.cached).toBe(2);
        expect(summary.stats.failed).toBe(1);

        const appSummary = summary.tasks.find((t) => t.taskId === "app:build");
        const librarySummary = summary.tasks.find((t) => t.taskId === "lib:build");
        const apiSummary = summary.tasks.find((t) => t.taskId === "api:build");
        const webSummary = summary.tasks.find((t) => t.taskId === "web:build");

        expect(appSummary?.cacheStatus).toBe("MISS");
        expect(librarySummary?.cacheStatus).toBe("HIT");
        expect(apiSummary?.cacheStatus).toBe("REMOTE_HIT");
        expect(webSummary?.cacheStatus).toBe("MISS");
    });

    it("should include task dependencies", () => {
        expect.assertions(1);

        const taskA = createTask("app:build");
        const taskB = createTask("lib:build");

        const results: TaskResults = new Map([
            ["app:build", createResult(taskA, "success")],
            ["lib:build", createResult(taskB, "success")],
        ]);

        const taskGraph: TaskGraph = {
            dependencies: { "app:build": ["lib:build"], "lib:build": [] },
            roots: ["lib:build"],
            tasks: { "app:build": taskA, "lib:build": taskB },
        };

        const summary = generateRunSummary(results, taskGraph, Date.now());
        const appSummary = summary.tasks.find((t) => t.taskId === "app:build");

        expect(appSummary?.dependencies).toStrictEqual(["lib:build"]);
    });

    it("should include environment info", () => {
        expect.assertions(3);

        const results: TaskResults = new Map();
        const taskGraph: TaskGraph = {
            dependencies: {},
            roots: [],
            tasks: {},
        };

        const summary = generateRunSummary(results, taskGraph, Date.now());

        expect(summary.environment.nodeVersion).toBe(process.version);
        expect(summary.environment.platform).toBe(process.platform);
        expect(summary.environment.arch).toBe(process.arch);
    });

    it("should include hash details when available", () => {
        expect.assertions(3);

        const task = createTask("app:build", {
            hash: "abc123",
            hashDetails: {
                command: "cmd-hash",
                nodes: { "src/index.ts": "file-hash" },
                runtime: { "env:NODE_ENV": "env-hash" },
            },
        });

        const results: TaskResults = new Map([["app:build", createResult(task, "success")]]);

        const taskGraph: TaskGraph = {
            dependencies: { "app:build": [] },
            roots: ["app:build"],
            tasks: { "app:build": task },
        };

        const summary = generateRunSummary(results, taskGraph, Date.now());
        const taskSummary = summary.tasks[0];

        expect(taskSummary?.hash).toBe("abc123");
        expect(taskSummary?.hashDetails?.command).toBe("cmd-hash");
        expect(taskSummary?.hashDetails?.nodes["src/index.ts"]).toBe("file-hash");
    });

    it("should handle skipped tasks (dry-run)", () => {
        expect.assertions(2);

        const task = createTask("app:build");

        const results: TaskResults = new Map([["app:build", createResult(task, "skipped")]]);

        const taskGraph: TaskGraph = {
            dependencies: { "app:build": [] },
            roots: ["app:build"],
            tasks: { "app:build": task },
        };

        const summary = generateRunSummary(results, taskGraph, Date.now());

        expect(summary.stats.skipped).toBe(1);
        expect(summary.tasks[0]?.cacheStatus).toBe("SKIPPED");
    });

    it("should calculate task duration", () => {
        expect.assertions(1);

        const now = Date.now();
        const task = createTask("app:build");
        const result = createResult(task, "success", {
            endTime: now,
            startTime: now - 3000,
        });

        const results: TaskResults = new Map([["app:build", result]]);

        const taskGraph: TaskGraph = {
            dependencies: { "app:build": [] },
            roots: ["app:build"],
            tasks: { "app:build": task },
        };

        const summary = generateRunSummary(results, taskGraph, now - 5000);

        expect(summary.tasks[0]?.duration).toBe(3000);
    });
});

describe(writeRunSummary, () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    it("should write summary to .task-runner/runs/ directory", async () => {
        expect.assertions(3);

        const summary: RunSummary = {
            duration: 1000,
            endTime: new Date().toISOString(),
            environment: {
                arch: process.arch,
                nodeVersion: process.version,
                platform: process.platform,
            },
            id: "test-run-123",
            startTime: new Date().toISOString(),
            stats: { cached: 0, failed: 0, skipped: 0, succeeded: 0, total: 0 },
            taskGraph: { dependencies: {}, roots: [] },
            tasks: [],
        };

        const filePath = await writeRunSummary(summary, workspaceRoot);

        expect(filePath).toContain(".task-runner/runs/test-run-123.json");

        const content = await readFile(filePath, "utf8");
        const parsed = JSON.parse(content) as RunSummary;

        expect(parsed.id).toBe("test-run-123");
        expect(parsed.duration).toBe(1000);
    });

    it("should create the runs directory if it does not exist", async () => {
        expect.assertions(1);

        const summary: RunSummary = {
            duration: 500,
            endTime: new Date().toISOString(),
            environment: {
                arch: process.arch,
                nodeVersion: process.version,
                platform: process.platform,
            },
            id: "new-run",
            startTime: new Date().toISOString(),
            stats: { cached: 0, failed: 0, skipped: 0, succeeded: 0, total: 0 },
            taskGraph: { dependencies: {}, roots: [] },
            tasks: [],
        };

        await writeRunSummary(summary, workspaceRoot);

        const runsDirectory = join(workspaceRoot, ".task-runner", "runs");
        const entries = await readdir(runsDirectory);

        expect(entries).toContain("new-run.json");
    });

    it("should write valid JSON with pretty formatting", async () => {
        expect.assertions(4);

        const summary: RunSummary = {
            duration: 2000,
            endTime: new Date().toISOString(),
            environment: {
                arch: process.arch,
                nodeVersion: process.version,
                platform: process.platform,
            },
            id: "formatted-run",
            startTime: new Date().toISOString(),
            stats: { cached: 0, failed: 0, skipped: 0, succeeded: 1, total: 1 },
            taskGraph: { dependencies: { "app:build": [] }, roots: ["app:build"] },
            tasks: [
                {
                    cacheable: true,
                    cacheStatus: "MISS",
                    dependencies: [],
                    duration: 1500,
                    endTime: new Date().toISOString(),
                    exitCode: 0,
                    hash: "abc123",
                    hashDetails: undefined,
                    outputs: ["dist/**"],
                    startTime: new Date().toISOString(),
                    target: { project: "app", target: "build" },
                    taskId: "app:build",
                },
            ],
        };

        const filePath = await writeRunSummary(summary, workspaceRoot);
        const content = await readFile(filePath, "utf8");

        // Verify it's pretty-printed (has newlines and indentation)
        expect(content).toContain("\n");
        expect(content).toContain("  ");

        // Verify round-trip
        const parsed = JSON.parse(content) as RunSummary;

        expect(parsed.tasks[0]?.cacheStatus).toBe("MISS");
        expect(parsed.stats.succeeded).toBe(1);
    });
});

describe(writeLastRunSummary, () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    const makeSummary = (id: string): RunSummary => {
        return {
            duration: 123,
            endTime: new Date().toISOString(),
            environment: {
                arch: process.arch,
                nodeVersion: process.version,
                platform: process.platform,
            },
            id,
            startTime: new Date().toISOString(),
            stats: { cached: 0, failed: 0, skipped: 0, succeeded: 0, total: 0 },
            taskGraph: { dependencies: {}, roots: [] },
            tasks: [],
        };
    };

    it("persists to a stable path and overwrites on repeat runs", async () => {
        expect.assertions(3);

        const expectedPath = getLastRunSummaryPath(workspaceRoot);

        const first = await writeLastRunSummary(makeSummary("first"), workspaceRoot);

        expect(first).toBe(expectedPath);

        const second = await writeLastRunSummary(makeSummary("second"), workspaceRoot);

        expect(second).toBe(expectedPath);

        const parsed = JSON.parse(await readFile(expectedPath, "utf8")) as RunSummary;

        expect(parsed.id).toBe("second");
    });

    it("readLastRunSummary returns undefined when no run has been recorded", async () => {
        expect.assertions(1);

        const result = await readLastRunSummary(workspaceRoot);

        expect(result).toBeUndefined();
    });

    it("readLastRunSummary round-trips the most-recent run", async () => {
        expect.assertions(1);

        await writeLastRunSummary(makeSummary("abc"), workspaceRoot);

        const parsed = await readLastRunSummary(workspaceRoot);

        expect(parsed?.id).toBe("abc");
    });
});
