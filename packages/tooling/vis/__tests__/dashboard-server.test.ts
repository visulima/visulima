import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { RunningDashboard } from "../src/dashboard/server";
import { startDashboardServer } from "../src/dashboard/server";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "./test-helpers";

const writeRun = (dir: string, id: string, body: unknown): void => {
    const runsDir = join(dir, ".vis", "runs");

    mkdirSync(runsDir, { recursive: true });
    writeFileSync(join(runsDir, `${id}.json`), JSON.stringify(body));
};

describe("dashboard server", () => {
    let tmpDir: string;
    let server: RunningDashboard | undefined;

    beforeEach(() => {
        tmpDir = createTemporaryDirectory("vis-dashboard-");
    });

    afterEach(async () => {
        if (server) {
            await server.close();
            server = undefined;
        }

        cleanupTemporaryDirectory(tmpDir);
    });

    it("serves the HTML shell at /", async () => {
        expect.assertions(2);

        server = await startDashboardServer({
            workspaceRoot: tmpDir,
            cacheDirectory: join(tmpDir, ".task-runner-cache"),
            host: "127.0.0.1",
            port: 0,
        });

        const response = await fetch(`${server.url}/`);

        expect(response.headers.get("content-type")).toContain("text/html");
        expect(await response.text()).toContain("vis dashboard");
    });

    it("returns an empty runs list when no runs are recorded", async () => {
        expect.assertions(1);

        server = await startDashboardServer({
            workspaceRoot: tmpDir,
            cacheDirectory: join(tmpDir, ".task-runner-cache"),
            host: "127.0.0.1",
            port: 0,
        });

        const response = await fetch(`${server.url}/api/runs`);
        const body = (await response.json()) as { runs: unknown[] };

        expect(body.runs).toStrictEqual([]);
    });

    it("returns recorded runs sorted newest-first", async () => {
        expect.assertions(2);

        writeRun(tmpDir, "old", {
            id: "old",
            startTime: "2026-01-01T00:00:00Z",
            duration: 1000,
            stats: { total: 1, cached: 0, succeeded: 1, failed: 0, skipped: 0 },
            tasks: [],
        });
        writeRun(tmpDir, "new", {
            id: "new",
            startTime: "2026-01-02T00:00:00Z",
            duration: 500,
            stats: { total: 1, cached: 1, succeeded: 0, failed: 0, skipped: 0 },
            tasks: [],
        });

        server = await startDashboardServer({
            workspaceRoot: tmpDir,
            cacheDirectory: join(tmpDir, ".task-runner-cache"),
            host: "127.0.0.1",
            port: 0,
        });

        const response = await fetch(`${server.url}/api/runs`);
        const body = (await response.json()) as { runs: { id: string }[] };

        expect(body.runs[0]?.id).toBe("new");
        expect(body.runs[1]?.id).toBe("old");
    });

    it("returns a 404 for unknown run IDs", async () => {
        expect.assertions(1);

        server = await startDashboardServer({
            workspaceRoot: tmpDir,
            cacheDirectory: join(tmpDir, ".task-runner-cache"),
            host: "127.0.0.1",
            port: 0,
        });

        const response = await fetch(`${server.url}/api/runs/does-not-exist`);

        expect(response.status).toBe(404);
    });

    it("rejects path traversal attempts in run ID", async () => {
        expect.assertions(1);

        server = await startDashboardServer({
            workspaceRoot: tmpDir,
            cacheDirectory: join(tmpDir, ".task-runner-cache"),
            host: "127.0.0.1",
            port: 0,
        });

        const response = await fetch(`${server.url}/api/runs/${encodeURIComponent("../../etc/passwd")}`);

        expect(response.status).toBe(404);
    });

    it("returns a cache-miss diff for a known task", async () => {
        expect.assertions(2);

        writeRun(tmpDir, "run-1", {
            id: "run-1",
            startTime: "2026-01-01T00:00:00Z",
            duration: 100,
            stats: { total: 1, cached: 1, succeeded: 0, failed: 0, skipped: 0 },
            tasks: [
                {
                    taskId: "app:build",
                    cacheStatus: "HIT",
                    hash: "old",
                    target: { project: "app", target: "build" },
                    hashDetails: { command: "tsc", nodes: { "a.ts": "x" }, implicitDeps: {}, runtime: {} },
                },
            ],
        });
        writeRun(tmpDir, "run-2", {
            id: "run-2",
            startTime: "2026-01-02T00:00:00Z",
            duration: 200,
            stats: { total: 1, cached: 0, succeeded: 1, failed: 0, skipped: 0 },
            tasks: [
                {
                    taskId: "app:build",
                    cacheStatus: "MISS",
                    hash: "new",
                    target: { project: "app", target: "build" },
                    hashDetails: { command: "tsc", nodes: { "a.ts": "y" }, implicitDeps: {}, runtime: {} },
                },
            ],
        });

        server = await startDashboardServer({
            workspaceRoot: tmpDir,
            cacheDirectory: join(tmpDir, ".task-runner-cache"),
            host: "127.0.0.1",
            port: 0,
        });

        const response = await fetch(
            `${server.url}/api/runs/run-2/tasks/${encodeURIComponent("app:build")}/diff`,
        );
        const body = (await response.json()) as { entries: { key: string; change: string }[]; previousRunId: string };

        expect(body.previousRunId).toBe("run-1");
        expect(body.entries.some((e) => e.key === "a.ts" && e.change === "modified")).toBe(true);
    });

    it("exposes environment info", async () => {
        expect.assertions(2);

        server = await startDashboardServer({
            workspaceRoot: tmpDir,
            cacheDirectory: join(tmpDir, ".task-runner-cache"),
            host: "127.0.0.1",
            port: 0,
        });

        const response = await fetch(`${server.url}/api/environment`);
        const body = (await response.json()) as { workspaceRoot: string; node: string };

        expect(body.workspaceRoot).toBe(tmpDir);
        expect(body.node).toBe(process.version);
    });

    it("serves the SSE endpoint with the correct content-type", async () => {
        expect.assertions(1);

        server = await startDashboardServer({
            workspaceRoot: tmpDir,
            cacheDirectory: join(tmpDir, ".task-runner-cache"),
            host: "127.0.0.1",
            port: 0,
        });

        const controller = new AbortController();

        try {
            const response = await fetch(`${server.url}/api/events`, {
                signal: controller.signal,
                headers: { accept: "text/event-stream" },
            });

            expect(response.headers.get("content-type")).toContain("text/event-stream");
        } finally {
            controller.abort();
        }
    });
});
