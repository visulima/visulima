import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { RunningDashboard } from "../src/dashboard/server";
import { createDashboardApp, startDashboardServer } from "../src/dashboard/server";
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
            cacheDirectory: join(tmpDir, ".task-runner-cache"),
            host: "127.0.0.1",
            port: 0,
            workspaceRoot: tmpDir,
        });

        const response = await fetch(`${server.url}/`);

        expect(response.headers.get("content-type")).toContain("text/html");
        await expect(response.text()).resolves.toContain("vis · dashboard");
    });

    it("returns an empty runs list when no runs are recorded", async () => {
        expect.assertions(1);

        server = await startDashboardServer({
            cacheDirectory: join(tmpDir, ".task-runner-cache"),
            host: "127.0.0.1",
            port: 0,
            workspaceRoot: tmpDir,
        });

        const response = await fetch(`${server.url}/api/runs`);
        const body = (await response.json()) as { runs: unknown[] };

        expect(body.runs).toStrictEqual([]);
    });

    it("returns recorded runs sorted newest-first", async () => {
        expect.assertions(2);

        writeRun(tmpDir, "old", {
            duration: 1000,
            endTime: "2026-01-01T00:00:01Z",
            id: "old",
            startTime: "2026-01-01T00:00:00Z",
            stats: { cached: 0, failed: 0, skipped: 0, succeeded: 1, total: 1 },
            tasks: [],
        });
        writeRun(tmpDir, "new", {
            duration: 500,
            endTime: "2026-01-02T00:00:00.500Z",
            id: "new",
            startTime: "2026-01-02T00:00:00Z",
            stats: { cached: 1, failed: 0, skipped: 0, succeeded: 0, total: 1 },
            tasks: [],
        });

        server = await startDashboardServer({
            cacheDirectory: join(tmpDir, ".task-runner-cache"),
            host: "127.0.0.1",
            port: 0,
            workspaceRoot: tmpDir,
        });

        const response = await fetch(`${server.url}/api/runs`);
        const body = (await response.json()) as { runs: { id: string }[] };

        expect(body.runs[0]?.id).toBe("new");
        expect(body.runs[1]?.id).toBe("old");
    });

    it("returns a 404 for unknown run IDs", async () => {
        expect.assertions(1);

        server = await startDashboardServer({
            cacheDirectory: join(tmpDir, ".task-runner-cache"),
            host: "127.0.0.1",
            port: 0,
            workspaceRoot: tmpDir,
        });

        const response = await fetch(`${server.url}/api/runs/does-not-exist`);

        expect(response.status).toBe(404);
    });

    it("rejects path traversal attempts in run ID", async () => {
        expect.assertions(1);

        server = await startDashboardServer({
            cacheDirectory: join(tmpDir, ".task-runner-cache"),
            host: "127.0.0.1",
            port: 0,
            workspaceRoot: tmpDir,
        });

        const response = await fetch(`${server.url}/api/runs/${encodeURIComponent("../../etc/passwd")}`);

        expect(response.status).toBe(404);
    });

    it("returns a cache-miss diff for a known task", async () => {
        expect.assertions(2);

        writeRun(tmpDir, "run-1", {
            duration: 100,
            id: "run-1",
            startTime: "2026-01-01T00:00:00Z",
            stats: { cached: 1, failed: 0, skipped: 0, succeeded: 0, total: 1 },
            tasks: [
                {
                    cacheStatus: "HIT",
                    hash: "old",
                    hashDetails: { command: "tsc", implicitDeps: {}, nodes: { "a.ts": "x" }, runtime: {} },
                    target: { project: "app", target: "build" },
                    taskId: "app:build",
                },
            ],
        });
        writeRun(tmpDir, "run-2", {
            duration: 200,
            id: "run-2",
            startTime: "2026-01-02T00:00:00Z",
            stats: { cached: 0, failed: 0, skipped: 0, succeeded: 1, total: 1 },
            tasks: [
                {
                    cacheStatus: "MISS",
                    hash: "new",
                    hashDetails: { command: "tsc", implicitDeps: {}, nodes: { "a.ts": "y" }, runtime: {} },
                    target: { project: "app", target: "build" },
                    taskId: "app:build",
                },
            ],
        });

        server = await startDashboardServer({
            cacheDirectory: join(tmpDir, ".task-runner-cache"),
            host: "127.0.0.1",
            port: 0,
            workspaceRoot: tmpDir,
        });

        const response = await fetch(`${server.url}/api/runs/run-2/tasks/${encodeURIComponent("app:build")}/diff`);
        const body = (await response.json()) as { entries: { change: string; key: string }[]; previousRunId: string };

        expect(body.previousRunId).toBe("run-1");
        expect(body.entries.some((e) => e.key === "a.ts" && e.change === "modified")).toBe(true);
    });

    it("exposes environment info", async () => {
        expect.assertions(2);

        server = await startDashboardServer({
            cacheDirectory: join(tmpDir, ".task-runner-cache"),
            host: "127.0.0.1",
            port: 0,
            workspaceRoot: tmpDir,
        });

        const response = await fetch(`${server.url}/api/environment`);
        const body = (await response.json()) as { node: string; workspaceRoot: string };

        expect(body.workspaceRoot).toBe(tmpDir);
        expect(body.node).toBe(process.version);
    });

    it("rejects requests whose Host header is a non-local domain (DNS-rebinding guard)", async () => {
        expect.assertions(5);

        const app = createDashboardApp(
            {
                cacheDirectory: join(tmpDir, ".task-runner-cache"),
                host: "127.0.0.1",
                port: 0,
                workspaceRoot: tmpDir,
            },
            () => () => {},
        );

        const evil = await app.request("/api/environment", { headers: { host: "evil.example.com" } });

        expect(evil.status).toBe(403);

        const rebind = await app.request("/api/environment", { headers: { host: "attacker.test:8080" } });

        expect(rebind.status).toBe(403);

        const missing = await app.request("/api/environment");

        expect(missing.status).toBe(403);

        const loopback = await app.request("/api/environment", { headers: { host: "127.0.0.1:1234" } });

        expect(loopback.status).toBe(200);

        const localhost = await app.request("/api/environment", { headers: { host: "localhost:1234" } });

        expect(localhost.status).toBe(200);
    });

    it("serves the SSE endpoint with the correct content-type", async () => {
        expect.assertions(1);

        server = await startDashboardServer({
            cacheDirectory: join(tmpDir, ".task-runner-cache"),
            host: "127.0.0.1",
            port: 0,
            workspaceRoot: tmpDir,
        });

        const controller = new AbortController();

        try {
            const response = await fetch(`${server.url}/api/events`, {
                headers: { accept: "text/event-stream" },
                signal: controller.signal,
            });

            expect(response.headers.get("content-type")).toContain("text/event-stream");
        } finally {
            controller.abort();
        }
    });
});
