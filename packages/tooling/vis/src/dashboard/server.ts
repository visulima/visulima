import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { collectCacheEntries } from "../commands/cache";
import { analyzeFlakiness } from "../flakiness";
import type { LoadedRunSummary } from "../run-report";
import { loadRunSummaries } from "../run-report";
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

const sendJson = (response: ServerResponse, status: number, body: unknown): void => {
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
    });
    response.end(JSON.stringify(body));
};

const sendHtml = (response: ServerResponse, status: number, body: string): void => {
    response.writeHead(status, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
    });
    response.end(body);
};

const sendNotFound = (response: ServerResponse): void => {
    sendJson(response, 404, { error: "Not found" });
};

const readRunById = (workspaceRoot: string, id: string): LoadedRunSummary | undefined => {
    const safe = id.replaceAll(/[^\w.\-:]/g, "");

    if (safe.length === 0 || safe !== id) {
        return undefined;
    }

    const path = join(workspaceRoot, ".task-runner", "runs", `${safe}.json`);

    if (!isAccessibleSync(path)) {
        return undefined;
    }

    try {
        return readJsonSync(path) as LoadedRunSummary;
    } catch {
        return undefined;
    }
};

const handleRunsList = (workspaceRoot: string, response: ServerResponse): void => {
    const summaries = loadRunSummaries(workspaceRoot) as unknown as {
        id?: string;
        startTime?: string;
        endTime?: string;
        duration?: number;
        stats?: Record<string, number>;
    }[];

    const list = summaries
        .map((s) => ({
            id: s.id,
            startTime: s.startTime,
            endTime: s.endTime,
            duration: s.duration,
            stats: s.stats,
        }))
        .sort((a, b) => (b.startTime ?? "").localeCompare(a.startTime ?? ""));

    sendJson(response, 200, { runs: list });
};

const handleRunDetail = (workspaceRoot: string, id: string, response: ServerResponse): void => {
    const run = readRunById(workspaceRoot, id);

    if (!run) {
        sendNotFound(response);

        return;
    }

    sendJson(response, 200, run);
};

const handleCacheMissDiff = (workspaceRoot: string, runId: string, taskId: string, response: ServerResponse): void => {
    const run = readRunById(workspaceRoot, runId) as
        | { tasks?: { taskId?: string }[]; id?: string }
        | undefined;

    if (!run) {
        sendNotFound(response);

        return;
    }

    const task = run.tasks?.find((t) => t.taskId === taskId);

    if (!task) {
        sendNotFound(response);

        return;
    }

    const history = loadRunSummaries(workspaceRoot);
    const analysis = analyzeCacheMiss(history, run.id, task);

    sendJson(response, 200, analysis);
};

const handleCache = async (cacheDirectory: string, response: ServerResponse): Promise<void> => {
    if (!isAccessibleSync(cacheDirectory)) {
        sendJson(response, 200, { directory: cacheDirectory, exists: false, entries: [], totalBytes: 0 });

        return;
    }

    const entries = await collectCacheEntries(cacheDirectory);
    const totalBytes = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);
    const now = Date.now();

    sendJson(response, 200, {
        directory: cacheDirectory,
        exists: true,
        totalBytes,
        entries: entries.map((entry) => ({
            hash: entry.hash,
            sizeBytes: entry.sizeBytes,
            ageMs: now - entry.mtimeMs,
            mtimeIso: new Date(entry.mtimeMs).toISOString(),
        })),
    });
};

const handleMetrics = (workspaceRoot: string, response: ServerResponse): void => {
    const summaries = loadRunSummaries(workspaceRoot);
    const metrics = computeDashboardMetrics(summaries);
    const flaky = analyzeFlakiness(workspaceRoot, { minRuns: 2 }, summaries);

    sendJson(response, 200, { metrics, flaky });
};

const handleRequest = async (
    options: DashboardServerOptions,
    request: IncomingMessage,
    response: ServerResponse,
): Promise<void> => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const pathname = url.pathname;

    if (request.method !== "GET") {
        response.writeHead(405);
        response.end();

        return;
    }

    if (pathname === "/" || pathname === "/index.html") {
        sendHtml(response, 200, renderDashboardHtml());

        return;
    }

    if (pathname === "/api/overview") {
        handleMetrics(options.workspaceRoot, response);

        return;
    }

    if (pathname === "/api/runs") {
        handleRunsList(options.workspaceRoot, response);

        return;
    }

    const runMatch = /^\/api\/runs\/([^/]+)$/.exec(pathname);

    if (runMatch) {
        handleRunDetail(options.workspaceRoot, decodeURIComponent(runMatch[1]!), response);

        return;
    }

    const diffMatch = /^\/api\/runs\/([^/]+)\/tasks\/(.+)\/diff$/.exec(pathname);

    if (diffMatch) {
        handleCacheMissDiff(
            options.workspaceRoot,
            decodeURIComponent(diffMatch[1]!),
            decodeURIComponent(diffMatch[2]!),
            response,
        );

        return;
    }

    if (pathname === "/api/cache") {
        await handleCache(options.cacheDirectory, response);

        return;
    }

    if (pathname === "/api/environment") {
        sendJson(response, 200, {
            workspaceRoot: options.workspaceRoot,
            cacheDirectory: options.cacheDirectory,
            node: process.version,
            platform: process.platform,
            arch: process.arch,
        });

        return;
    }

    sendNotFound(response);
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
    const server = createServer((request, response) => {
        handleRequest(options, request, response).catch((error: unknown) => {
            sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
        });
    });

    await new Promise<void>((resolve, reject) => {
        const onError = (error: Error): void => {
            server.off("listening", onListening);
            reject(error);
        };
        const onListening = (): void => {
            server.off("error", onError);
            resolve();
        };

        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(options.port, options.host);
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
