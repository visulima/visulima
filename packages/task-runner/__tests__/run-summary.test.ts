import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { generateRunSummary, writeRunSummary } from "../src/run-summary";
import type { RunSummary } from "../src/run-summary";
import type { Task, TaskResult, TaskResults, TaskGraph } from "../src/types";

const createTmpDir = async (): Promise<string> => {
    const dir = join(tmpdir(), `summary-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(dir, { recursive: true });

    return dir;
};

const createTask = (id: string, overrides: Partial<Task> = {}): Task => ({
    id,
    target: {
        project: id.split(":")[0] as string,
        target: id.split(":")[1] as string,
    },
    overrides: {},
    outputs: [],
    ...overrides,
});

const createResult = (
    task: Task,
    status: TaskResult["status"],
    overrides: Partial<TaskResult> = {},
): TaskResult => ({
    task,
    status,
    startTime: Date.now() - 1000,
    endTime: Date.now(),
    code: status === "failure" ? 1 : 0,
    terminalOutput: `Output of ${task.id}`,
    ...overrides,
});

describe("generateRunSummary", () => {
    it("should generate a complete summary from task results", () => {
        const taskA = createTask("app:build", { hash: "abc123" });
        const taskB = createTask("lib:build", { hash: "def456" });

        const results: TaskResults = new Map([
            ["app:build", createResult(taskA, "success")],
            ["lib:build", createResult(taskB, "local-cache")],
        ]);

        const taskGraph: TaskGraph = {
            roots: ["lib:build"],
            tasks: { "app:build": taskA, "lib:build": taskB },
            dependencies: { "app:build": ["lib:build"], "lib:build": [] },
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
        const taskA = createTask("app:build");
        const taskB = createTask("lib:build");
        const taskC = createTask("api:build");
        const taskD = createTask("web:build");

        const results: TaskResults = new Map([
            ["app:build", createResult(taskA, "success")],
            ["lib:build", createResult(taskB, "local-cache")],
            ["api:build", createResult(taskC, "remote-cache")],
            ["web:build", createResult(taskD, "failure")],
        ]);

        const taskGraph: TaskGraph = {
            roots: ["app:build", "lib:build", "api:build", "web:build"],
            tasks: {
                "app:build": taskA,
                "lib:build": taskB,
                "api:build": taskC,
                "web:build": taskD,
            },
            dependencies: {
                "app:build": [],
                "lib:build": [],
                "api:build": [],
                "web:build": [],
            },
        };

        const summary = generateRunSummary(results, taskGraph, Date.now());

        expect(summary.stats.succeeded).toBe(1);
        expect(summary.stats.cached).toBe(2);
        expect(summary.stats.failed).toBe(1);

        const appSummary = summary.tasks.find((t) => t.taskId === "app:build");
        const libSummary = summary.tasks.find((t) => t.taskId === "lib:build");
        const apiSummary = summary.tasks.find((t) => t.taskId === "api:build");
        const webSummary = summary.tasks.find((t) => t.taskId === "web:build");

        expect(appSummary?.cacheStatus).toBe("MISS");
        expect(libSummary?.cacheStatus).toBe("HIT");
        expect(apiSummary?.cacheStatus).toBe("REMOTE_HIT");
        expect(webSummary?.cacheStatus).toBe("MISS");
    });

    it("should include task dependencies", () => {
        const taskA = createTask("app:build");
        const taskB = createTask("lib:build");

        const results: TaskResults = new Map([
            ["app:build", createResult(taskA, "success")],
            ["lib:build", createResult(taskB, "success")],
        ]);

        const taskGraph: TaskGraph = {
            roots: ["lib:build"],
            tasks: { "app:build": taskA, "lib:build": taskB },
            dependencies: { "app:build": ["lib:build"], "lib:build": [] },
        };

        const summary = generateRunSummary(results, taskGraph, Date.now());
        const appSummary = summary.tasks.find((t) => t.taskId === "app:build");

        expect(appSummary?.dependencies).toEqual(["lib:build"]);
    });

    it("should include environment info", () => {
        const results: TaskResults = new Map();
        const taskGraph: TaskGraph = {
            roots: [],
            tasks: {},
            dependencies: {},
        };

        const summary = generateRunSummary(results, taskGraph, Date.now());

        expect(summary.environment.nodeVersion).toBe(process.version);
        expect(summary.environment.platform).toBe(process.platform);
        expect(summary.environment.arch).toBe(process.arch);
    });

    it("should include hash details when available", () => {
        const task = createTask("app:build", {
            hash: "abc123",
            hashDetails: {
                command: "cmd-hash",
                nodes: { "src/index.ts": "file-hash" },
                runtime: { "env:NODE_ENV": "env-hash" },
            },
        });

        const results: TaskResults = new Map([
            ["app:build", createResult(task, "success")],
        ]);

        const taskGraph: TaskGraph = {
            roots: ["app:build"],
            tasks: { "app:build": task },
            dependencies: { "app:build": [] },
        };

        const summary = generateRunSummary(results, taskGraph, Date.now());
        const taskSummary = summary.tasks[0];

        expect(taskSummary?.hash).toBe("abc123");
        expect(taskSummary?.hashDetails?.command).toBe("cmd-hash");
        expect(taskSummary?.hashDetails?.nodes["src/index.ts"]).toBe("file-hash");
    });

    it("should handle skipped tasks (dry-run)", () => {
        const task = createTask("app:build");

        const results: TaskResults = new Map([
            ["app:build", createResult(task, "skipped")],
        ]);

        const taskGraph: TaskGraph = {
            roots: ["app:build"],
            tasks: { "app:build": task },
            dependencies: { "app:build": [] },
        };

        const summary = generateRunSummary(results, taskGraph, Date.now());

        expect(summary.stats.skipped).toBe(1);
        expect(summary.tasks[0]?.cacheStatus).toBe("SKIPPED");
    });

    it("should calculate task duration", () => {
        const now = Date.now();
        const task = createTask("app:build");
        const result = createResult(task, "success", {
            startTime: now - 3000,
            endTime: now,
        });

        const results: TaskResults = new Map([["app:build", result]]);

        const taskGraph: TaskGraph = {
            roots: ["app:build"],
            tasks: { "app:build": task },
            dependencies: { "app:build": [] },
        };

        const summary = generateRunSummary(results, taskGraph, now - 5000);

        expect(summary.tasks[0]?.duration).toBe(3000);
    });
});

describe("writeRunSummary", () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTmpDir();
    });

    afterEach(async () => {
        await rm(workspaceRoot, { recursive: true, force: true });
    });

    it("should write summary to .task-runner/runs/ directory", async () => {
        const summary: RunSummary = {
            id: "test-run-123",
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            duration: 1000,
            tasks: [],
            stats: { total: 0, succeeded: 0, failed: 0, cached: 0, skipped: 0 },
            taskGraph: { roots: [], dependencies: {} },
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
            },
        };

        const filePath = await writeRunSummary(summary, workspaceRoot);

        expect(filePath).toContain(".task-runner/runs/test-run-123.json");

        const content = await readFile(filePath, "utf-8");
        const parsed = JSON.parse(content) as RunSummary;

        expect(parsed.id).toBe("test-run-123");
        expect(parsed.duration).toBe(1000);
    });

    it("should create the runs directory if it does not exist", async () => {
        const summary: RunSummary = {
            id: "new-run",
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            duration: 500,
            tasks: [],
            stats: { total: 0, succeeded: 0, failed: 0, cached: 0, skipped: 0 },
            taskGraph: { roots: [], dependencies: {} },
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
            },
        };

        await writeRunSummary(summary, workspaceRoot);

        const runsDir = join(workspaceRoot, ".task-runner", "runs");
        const entries = await readdir(runsDir);

        expect(entries).toContain("new-run.json");
    });

    it("should write valid JSON with pretty formatting", async () => {
        const task = createTask("app:build", { hash: "abc123" });

        const summary: RunSummary = {
            id: "formatted-run",
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            duration: 2000,
            tasks: [
                {
                    taskId: "app:build",
                    target: { project: "app", target: "build" },
                    hash: "abc123",
                    hashDetails: undefined,
                    outputs: ["dist/**"],
                    cacheStatus: "MISS",
                    exitCode: 0,
                    startTime: new Date().toISOString(),
                    endTime: new Date().toISOString(),
                    duration: 1500,
                    dependencies: [],
                    cacheable: true,
                },
            ],
            stats: { total: 1, succeeded: 1, failed: 0, cached: 0, skipped: 0 },
            taskGraph: { roots: ["app:build"], dependencies: { "app:build": [] } },
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
            },
        };

        const filePath = await writeRunSummary(summary, workspaceRoot);
        const content = await readFile(filePath, "utf-8");

        // Verify it's pretty-printed (has newlines and indentation)
        expect(content).toContain("\n");
        expect(content).toContain("  ");

        // Verify round-trip
        const parsed = JSON.parse(content) as RunSummary;

        expect(parsed.tasks[0]?.cacheStatus).toBe("MISS");
        expect(parsed.stats.succeeded).toBe(1);
    });
});
