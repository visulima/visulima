import { readdir, readFile, stat } from "node:fs/promises";

import { join } from "@visulima/path";
// eslint-disable-next-line import/no-namespace -- zod's `z` is a namespace export per zod/consistent-import
import * as z from "zod";

import type { ToolContext, ToolDeps } from "../response";
import { errorResponse, okResponse } from "../response";

const JSON_SUFFIX_PATTERN = /\.json$/;

interface RunSummaryShape {
    [key: string]: unknown;
    runId?: string;
    startedAt?: string;
    status?: string;
    tasks?: { status?: string }[];
}

interface RunListEntry {
    failedTasks?: number;
    modifiedMs: number;
    runId: string;
    startedAt?: string;
    status?: string;
    taskCount?: number;
}

/**
 * Derive a coarse run status from a summary when it doesn't carry one
 * explicitly: any failed task makes the run a failure, otherwise success.
 */
const deriveStatus = (summary: RunSummaryShape): string | undefined => {
    if (typeof summary.status === "string") {
        return summary.status;
    }

    if (!summary.tasks) {
        return undefined;
    }

    return summary.tasks.some((task) => task.status === "failure" || task.status === "failed") ? "failure" : "success";
};

export const registerListRuns = ({ server }: ToolDeps, context: ToolContext): void => {
    server.registerTool(
        "list_runs",
        {
            annotations: { readOnlyHint: true },
            description:
                "List recorded vis runs from `.task-runner/runs/`, most recent first. Each entry includes the run ID, start "
                + "timestamp, derived status, task count, and failed-task count — use it to discover run IDs for `get_run_logs`, "
                + '`cache_hash`, or `cache_why` (e.g. "compare this run to the previous one").',
            inputSchema: {
                limit: z.int().positive().max(100).optional().describe("Maximum runs to return (default: 20, newest first)."),
            },
        },
        async ({ limit }: { limit?: number }) => {
            const runsDirectory = join(context.workspaceRoot, ".task-runner", "runs");

            let files: string[];

            try {
                const names = await readdir(runsDirectory);

                files = names.filter((name) => name.endsWith(".json"));
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                    // No runs directory yet — an empty list is the honest answer,
                    // not an error (agents poll this before a first run).
                    return okResponse({ count: 0, runs: [] });
                }

                return errorResponse(error);
            }

            try {
                // Phase 1: stat every candidate (cheap — no file contents read),
                // sort newest-first by mtime, and keep only the requested window.
                // The result is capped at `limit`, so there's no point reading &
                // parsing summaries that can never make the cut.
                const stated = await Promise.all(
                    files.map(async (file): Promise<{ file: string; modifiedMs: number } | undefined> => {
                        try {
                            const stats = await stat(join(runsDirectory, file));

                            return { file, modifiedMs: stats.mtimeMs };
                        } catch {
                            // Skip files that vanished / can't be stat'd rather than
                            // failing the whole listing.
                            return undefined;
                        }
                    }),
                );

                const newest = stated
                    .filter((entry): entry is { file: string; modifiedMs: number } => entry !== undefined)
                    // Newest first by file mtime — robust even when summaries omit
                    // `startedAt`.
                    .toSorted((a, b) => b.modifiedMs - a.modifiedMs)
                    .slice(0, limit ?? 20);

                // Phase 2: read + parse only the selected summaries.
                const entries = await Promise.all(
                    newest.map(async ({ file, modifiedMs }): Promise<RunListEntry | undefined> => {
                        try {
                            const raw = await readFile(join(runsDirectory, file), "utf8");
                            const summary = JSON.parse(raw) as RunSummaryShape;

                            return {
                                failedTasks: summary.tasks?.filter((task) => task.status === "failure" || task.status === "failed").length,
                                modifiedMs,
                                runId: summary.runId ?? file.replace(JSON_SUFFIX_PATTERN, ""),
                                startedAt: summary.startedAt,
                                status: deriveStatus(summary),
                                taskCount: summary.tasks?.length,
                            };
                        } catch {
                            // Skip unreadable / malformed run files rather than
                            // failing the whole listing.
                            return undefined;
                        }
                    }),
                );

                const runs = entries
                    .filter((entry): entry is RunListEntry => entry !== undefined)
                    .map((entry): Omit<RunListEntry, "modifiedMs"> => {
                        const { failedTasks, runId, startedAt, status, taskCount } = entry;

                        return { failedTasks, runId, startedAt, status, taskCount };
                    });

                return okResponse({ count: runs.length, runs });
            } catch (error) {
                return errorResponse(error);
            }
        },
    );
};
