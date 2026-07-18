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
import { getVisLastSummaryPath, getVisRunsDir } from "../util/vis-paths";
import { analyzeCacheMiss } from "./cache-diff";
import { renderDashboardHtml } from "./html";
import { computeDashboardMetrics } from "./metrics";

export interface DashboardServerOptions {
    cacheDirectory: string;
    host: string;
    port: number;
    workspaceRoot: string;
}

export interface RunningDashboard {
    close: () => Promise<void>;
    port: number;
    url: string;
}

interface ChangeEvent {
    id: string;
    // `fs.watch` reports "rename" for both creates and deletes, so we can't reliably
    // distinguish add/update/remove from the raw event. The client only invalidates
    // queries on any change, so a single neutral type is sufficient.
    type: "run-changed";
}

type ChangeListener = (event: ChangeEvent) => void;

const IPV4_HOST_REGEX = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/**
 * DNS-rebinding guard: only answer requests whose Host header is a loopback
 * name, a literal IP (unreachable via rebinding, which needs a hostname
 * re-resolving to a loopback address), or the explicitly configured `--host`.
 * A malicious page pointing an attacker domain at 127.0.0.1 would arrive with
 * that domain in the Host header and be rejected.
 */
const isAllowedDashboardHost = (hostHeader: string | undefined, configuredHost: string): boolean => {
    if (hostHeader === undefined || hostHeader === "") {
        return false;
    }

    let host = hostHeader;

    if (host.startsWith("[")) {
        // Bracketed IPv6, e.g. `[::1]:1234`.
        const end = host.indexOf("]");

        host = end === -1 ? host.slice(1) : host.slice(1, end);
    } else if (!host.includes("::")) {
        // Strip `:port`, skipping unbracketed IPv6 literals (which contain `::`).
        const colon = host.indexOf(":");

        host = colon === -1 ? host : host.slice(0, colon);
    }

    host = host.toLowerCase();

    if (host === "localhost" || host === configuredHost.toLowerCase()) {
        return true;
    }

    return IPV4_HOST_REGEX.test(host) || host.includes(":");
};

const readRunById = (workspaceRoot: string, id: string): LoadedRunSummary | undefined => {
    const safe = id.replaceAll(/[^\w.\-:]/g, "");

    if (safe.length === 0 || safe !== id) {
        return undefined;
    }

    const path = join(getVisRunsDir(workspaceRoot), `${safe}.json`);

    if (isAccessibleSync(path)) {
        try {
            return readJsonSync(path) as LoadedRunSummary;
        } catch {
            return undefined;
        }
    }

    // Fallback: `.vis/last-summary.json` is written on every run even
    // without `--summarize`. If its id matches, surface it so the
    // /api/runs/:id navigation works for the single-run case too.
    const lastSummaryPath = getVisLastSummaryPath(workspaceRoot);

    if (!isAccessibleSync(lastSummaryPath)) {
        return undefined;
    }

    try {
        const summary = readJsonSync(lastSummaryPath) as LoadedRunSummary & { id?: string };

        return summary.id === safe ? summary : undefined;
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
 * On a fresh workspace we `mkdir -p` the runs dir before attaching the
 * watcher so the common case "no runs yet" works. If both mkdir and
 * watch fail (e.g., permission denied), the dashboard still serves but
 * loses live updates — clients fall back to manual refresh. There is
 * no deferred retry; restart the dashboard once the issue is resolved.
 */
const createRunsWatcher = async (workspaceRoot: string): Promise<{ close: () => void; subscribe: (listener: ChangeListener) => () => void }> => {
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
        watcher = watch(runsDir, (_eventType, filename) => {
            if (!filename || typeof filename !== "string" || !filename.endsWith(".json")) {
                return;
            }

            const id = filename.slice(0, -".json".length);

            dispatch({ id, type: "run-changed" });
        });
    } catch {
        watcher = undefined;
    }

    return {
        close: () => {
            if (timer) {
                clearTimeout(timer);
            }

            watcher?.close();
            listeners.clear();
        },
        subscribe: (listener) => {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },
    };
};

/**
 * Builds the Hono application for a given workspace. Exported so tests
 * can exercise the routes via `app.request()` without spinning up a
 * real socket.
 */
export const createDashboardApp = (options: DashboardServerOptions, subscribe: (listener: ChangeListener) => () => void): Hono => {
    const app = new Hono();

    app.use("*", async (c, next) => {
        if (!isAllowedDashboardHost(c.req.header("host"), options.host)) {
            return c.json({ error: "Forbidden" }, 403);
        }

        return next();
    });

    app.get("/", (c) => c.html(renderDashboardHtml()));

    app.get("/api/overview", (c) => {
        const summaries = loadRunSummaries(options.workspaceRoot);
        const metrics = computeDashboardMetrics(summaries);
        const flaky = analyzeFlakiness(options.workspaceRoot, { minRuns: 2 }, summaries);

        return c.json({ flaky, metrics });
    });

    app.get("/api/runs", (c) => {
        const summaries = loadRunSummaries(options.workspaceRoot) as unknown as {
            duration?: number;
            endTime?: string;
            id?: string;
            startTime?: string;
            stats?: Record<string, unknown>;
        }[];

        // Drop summaries missing identifying fields so the response matches the
        // typed contract on the client (RunListItem). Older / partial summary
        // files would otherwise leak undefined through to UI code that does
        // `.localeCompare` / arithmetic.
        const runs = summaries
            .filter(
                (s): s is { duration: number; endTime: string; id: string; startTime: string; stats?: Record<string, unknown> } =>
                    typeof s.id === "string" && typeof s.startTime === "string" && typeof s.endTime === "string" && typeof s.duration === "number",
            )
            .map((s) => {
                const rawStats = s.stats;
                const stats = rawStats
                    ? {
                        cached: typeof rawStats.cached === "number" ? rawStats.cached : undefined,
                        failed: typeof rawStats.failed === "number" ? rawStats.failed : undefined,
                        skipped: typeof rawStats.skipped === "number" ? rawStats.skipped : undefined,
                        succeeded: typeof rawStats.succeeded === "number" ? rawStats.succeeded : undefined,
                        total: typeof rawStats.total === "number" ? rawStats.total : undefined,
                    }
                    : undefined;

                return {
                    duration: s.duration,
                    endTime: s.endTime,
                    id: s.id,
                    startTime: s.startTime,
                    stats,
                };
            })
            .sort((a, b) => b.startTime.localeCompare(a.startTime));

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
        const run = readRunById(options.workspaceRoot, c.req.param("runId")) as { id?: string; tasks?: { taskId?: string }[] } | undefined;

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
            return c.json({ directory: options.cacheDirectory, entries: [], exists: false, totalBytes: 0 });
        }

        const entries = await collectCacheEntries(options.cacheDirectory);
        const totalBytes = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);
        const now = Date.now();

        return c.json({
            directory: options.cacheDirectory,
            entries: entries.map((entry) => {
                return {
                    ageMs: now - entry.mtimeMs,
                    hash: entry.hash,
                    mtimeIso: new Date(entry.mtimeMs).toISOString(),
                    sizeBytes: entry.sizeBytes,
                };
            }),
            exists: true,
            totalBytes,
        });
    });

    app.get("/api/environment", (c) =>
        c.json({
            arch: process.arch,
            cacheDirectory: options.cacheDirectory,
            node: process.version,
            platform: process.platform,
            workspaceRoot: options.workspaceRoot,
        }));

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
            await stream.writeSSE({ data: JSON.stringify({ ok: true }), event: "ready" });

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
                        await stream.writeSSE({ data: "", event: "heartbeat" });

                        continue;
                    }
                }

                const event = queue.shift()!;

                await stream.writeSSE({ data: JSON.stringify(event), event: "change" });
            }
        }));

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
        server.once("listening", () => {
            resolve();
        });
        server.once("error", (error: Error) => {
            reject(error);
        });
    });

    const address = server.address() as AddressInfo;
    const boundPort = typeof address === "object" && address ? address.port : options.port;
    // Wildcard binds (IPv4 0.0.0.0, IPv6 ::/::0) aren't valid in a URL — substitute the loopback name.
    // eslint-disable-next-line sonarjs/no-hardcoded-ip -- string comparison against canonical wildcard literals, not a binding target.
    const isWildcard = options.host === "0.0.0.0" || options.host === "::" || options.host === "::0";
    const displayHost = isWildcard ? "localhost" : options.host;
    const url = `http://${displayHost}:${String(boundPort)}`;

    return {
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
        port: boundPort,
        url,
    };
};
