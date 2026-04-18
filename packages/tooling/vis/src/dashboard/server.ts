import { watch } from "node:fs";
import { mkdir } from "node:fs/promises";
import type { AddressInfo } from "node:net";

import { serve } from "@hono/node-server";
import { isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import { collectCacheEntries } from "../commands/cache/handler";
import { analyzeFlakiness } from "../report/flakiness";
import { loadRunSummaries } from "../report/run-report";
import type { LoadedRunSummary } from "../report/types";
import { getVisRunsDir } from "../util/vis-paths";
import { analyzeCacheMiss } from "./cache-diff";
import { renderDashboardHtml } from "./html";
import { computeDashboardMetrics } from "./metrics";

export interface DashboardServerOptions {
    workspaceRoot: string;
    cacheDirectory: string;
    host: string;
    port: number;
}

export interface RunningDashboard {
    url: string;
    port: number;
    close: () => Promise<void>;
}

interface ChangeEvent {
    type: "run-added" | "run-updated";
    id: string;
}

type ChangeListener = (event: ChangeEvent) => void;

const readRunById = (workspaceRoot: string, id: string): LoadedRunSummary | undefined => {
    const safe = id.replaceAll(/[^\w.\-:]/g, "");

    if (safe.length === 0 || safe !== id) {
        return undefined;
    }

    const path = join(getVisRunsDir(workspaceRoot), `${safe}.json`);

    if (!isAccessibleSync(path)) {
        return undefined;
    }

    try {
        return readJsonSync(path) as LoadedRunSummary;
    } catch {
        return undefined;
    }
};

/**
 * Watches `.task-runner/runs/` for newly landed summary files and fans
 * out a single event to every connected SSE client. `fs.watch` fires
 * multiple times for a single file write (create + content flushes),
 * so we debounce 200ms to coalesce bursts — the UI only needs to know
 * that something changed, not every syscall.
 *
 * If the directory doesn't exist yet (first run on a fresh workspace)
 * we still create the watcher after the directory appears; callers
 * without a runs dir fall back to manual refresh.
 */
const createRunsWatcher = async (workspaceRoot: string): Promise<{ subscribe: (listener: ChangeListener) => () => void; close: () => void }> => {
    const listeners = new Set<ChangeListener>();
    const runsDir = getVisRunsDir(workspaceRoot);

    try {
        await mkdir(runsDir, { recursive: true });
    } catch {
        // Best effort — watcher creation below will skip if it still fails.
    }

    let timer: NodeJS.Timeout | undefined;
    let pending: ChangeEvent | undefined;

    const dispatch = (event: ChangeEvent): void => {
        pending = event;

        if (timer) {
            clearTimeout(timer);
        }

        timer = setTimeout(() => {
            timer = undefined;

            if (!pending) {
                return;
            }

            const current = pending;

            pending = undefined;

            for (const listener of listeners) {
                try {
                    listener(current);
                } catch {
                    // A single listener throwing shouldn't kill the watcher.
                }
            }
        }, 200);
    };

    let watcher: ReturnType<typeof watch> | undefined;

    try {
        watcher = watch(runsDir, (eventType, filename) => {
            if (!filename || typeof filename !== "string" || !filename.endsWith(".json")) {
                return;
            }

            const id = filename.slice(0, -".json".length);

            dispatch({ type: eventType === "rename" ? "run-added" : "run-updated", id });
        });
    } catch {
        watcher = undefined;
    }

    return {
        subscribe: (listener) => {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },
        close: () => {
            if (timer) {
                clearTimeout(timer);
            }

            watcher?.close();
            listeners.clear();
        },
    };
};

/**
 * Builds the Hono application for a given workspace. Exported so tests
 * can exercise the routes via `app.request()` without spinning up a
 * real socket.
 */
export const createDashboardApp = (
    options: DashboardServerOptions,
    subscribe: (listener: ChangeListener) => () => void,
): Hono => {
    const app = new Hono();

    app.get("/", (c) => c.html(renderDashboardHtml()));

    app.get("/api/overview", (c) => {
        const summaries = loadRunSummaries(options.workspaceRoot);
        const metrics = computeDashboardMetrics(summaries);
        const flaky = analyzeFlakiness(options.workspaceRoot, { minRuns: 2 }, summaries);

        return c.json({ metrics, flaky });
    });

    app.get("/api/runs", (c) => {
        const summaries = loadRunSummaries(options.workspaceRoot) as unknown as {
            id?: string;
            startTime?: string;
            endTime?: string;
            duration?: number;
            stats?: Record<string, number>;
        }[];

        const runs = summaries
            .map((s) => ({
                id: s.id,
                startTime: s.startTime,
                endTime: s.endTime,
                duration: s.duration,
                stats: s.stats,
            }))
            .sort((a, b) => (b.startTime ?? "").localeCompare(a.startTime ?? ""));

        return c.json({ runs });
    });

    app.get("/api/runs/:id", (c) => {
        const run = readRunById(options.workspaceRoot, c.req.param("id"));

        if (!run) {
            return c.json({ error: "Not found" }, 404);
        }

        return c.json(run);
    });

    app.get("/api/runs/:runId/tasks/:taskId/diff", (c) => {
        const run = readRunById(options.workspaceRoot, c.req.param("runId")) as
            | { tasks?: { taskId?: string }[]; id?: string }
            | undefined;

        if (!run) {
            return c.json({ error: "Run not found" }, 404);
        }

        const taskId = c.req.param("taskId");
        const task = run.tasks?.find((t) => t.taskId === taskId);

        if (!task) {
            return c.json({ error: "Task not found" }, 404);
        }

        const history = loadRunSummaries(options.workspaceRoot);
        const analysis = analyzeCacheMiss(history, run.id, task);

        return c.json(analysis);
    });

    app.get("/api/cache", async (c) => {
        if (!isAccessibleSync(options.cacheDirectory)) {
            return c.json({ directory: options.cacheDirectory, exists: false, entries: [], totalBytes: 0 });
        }

        const entries = await collectCacheEntries(options.cacheDirectory);
        const totalBytes = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);
        const now = Date.now();

        return c.json({
            directory: options.cacheDirectory,
            exists: true,
            totalBytes,
            entries: entries.map((entry) => ({
                hash: entry.hash,
                sizeBytes: entry.sizeBytes,
                ageMs: now - entry.mtimeMs,
                mtimeIso: new Date(entry.mtimeMs).toISOString(),
            })),
        });
    });

    app.get("/api/environment", (c) =>
        c.json({
            workspaceRoot: options.workspaceRoot,
            cacheDirectory: options.cacheDirectory,
            node: process.version,
            platform: process.platform,
            arch: process.arch,
        }),
    );

    // Server-Sent Events: pushes `change` events when the runs directory
    // gets a new summary. The UI uses these to invalidate TanStack Query
    // caches without polling.
    app.get("/api/events", (c) =>
        streamSSE(c, async (stream) => {
            const queue: ChangeEvent[] = [];
            let resolveNext: (() => void) | undefined;

            const unsubscribe = subscribe((event) => {
                queue.push(event);

                if (resolveNext) {
                    const r = resolveNext;

                    resolveNext = undefined;
                    r();
                }
            });

            stream.onAbort(() => {
                unsubscribe();

                if (resolveNext) {
                    const r = resolveNext;

                    resolveNext = undefined;
                    r();
                }
            });

            // Initial hello so clients know the stream is live.
            await stream.writeSSE({ event: "ready", data: JSON.stringify({ ok: true }) });

            const HEARTBEAT_MS = 15_000;

            while (!stream.aborted) {
                if (queue.length === 0) {
                    const heartbeat = stream.sleep(HEARTBEAT_MS);
                    const waiter = new Promise<void>((resolve) => {
                        resolveNext = resolve;
                    });

                    await Promise.race([heartbeat, waiter]);

                    if (stream.aborted) {
                        break;
                    }

                    if (queue.length === 0) {
                        await stream.writeSSE({ event: "heartbeat", data: "" });

                        continue;
                    }
                }

                const event = queue.shift()!;

                await stream.writeSSE({ event: "change", data: JSON.stringify(event) });
            }
        }),
    );

    return app;
};

/**
 * Starts the dashboard HTTP server on `options.port`.
 *
 * When `options.port` is 0 the OS assigns a free port — the returned
 * `url` reflects the actually bound port. The server binds to
 * `options.host` (default `127.0.0.1`) to avoid exposing local run
 * history on the network without an explicit opt-in.
 */
export const startDashboardServer = async (options: DashboardServerOptions): Promise<RunningDashboard> => {
    const watcher = await createRunsWatcher(options.workspaceRoot);
    const app = createDashboardApp(options, watcher.subscribe);

    const server = serve({
        fetch: app.fetch,
        hostname: options.host,
        port: options.port,
    });

    await new Promise<void>((resolve, reject) => {
        server.once("listening", () => resolve());
        server.once("error", (error) => reject(error));
    });

    const address = server.address() as AddressInfo;
    const boundPort = typeof address === "object" && address ? address.port : options.port;
    const displayHost = options.host === "0.0.0.0" ? "localhost" : options.host;
    const url = `http://${displayHost}:${String(boundPort)}`;

    return {
        url,
        port: boundPort,
        close: (): Promise<void> =>
            new Promise((resolve, reject) => {
                watcher.close();
                server.close((error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            }),
    };
};
