import { readFile } from "node:fs/promises";

import { join } from "@visulima/path";
// eslint-disable-next-line import/no-namespace -- zod's `z` is a namespace export per zod/consistent-import
import * as z from "zod";

import type { ToolContext, ToolDeps } from "../response";
import { errorResponse, okResponse } from "../response";
import { isValidRunId } from "../validation";

interface RunSummary {
    [key: string]: unknown;
    runId?: string;
    tasks?: { [key: string]: unknown; taskId?: string }[];
}

export const registerGetRunLogs = ({ server }: ToolDeps, context: ToolContext): void => {
    server.registerTool(
        "get_run_logs",
        {
            annotations: { readOnlyHint: true },
            description:
                "Read a vis run summary from .vis/. Returns the most recent run by default, or a specific run when `runId` is set. Optionally filter to a single task with `taskId`.",
            inputSchema: {
                runId: z.string().optional().describe("Run ID (default: latest)"),
                taskId: z.string().optional().describe('Filter to a single task ID like "@my/app:build"'),
            },
        },
        async ({ runId, taskId }: { runId?: string; taskId?: string }) => {
            if (runId !== undefined && !isValidRunId(runId)) {
                return errorResponse(new Error(`Invalid runId "${runId}". Expected filesystem-safe slug ([A-Za-z0-9_.-]).`));
            }

            // `.vis/`, not the pre-cutover `.task-runner/` — vis stopped
            // writing there and now deletes it on startup, so the old paths
            // resolved to nothing on every workspace.
            const path = runId
                ? join(context.workspaceRoot, ".vis", "runs", `${runId}.json`)
                : join(context.workspaceRoot, ".vis", "last-summary.json");

            try {
                const raw = await readFile(path, "utf8");
                const summary = JSON.parse(raw) as RunSummary;

                if (taskId) {
                    const task = summary.tasks?.find((entry) => entry.taskId === taskId);

                    if (!task) {
                        return errorResponse(new Error(`Task "${taskId}" not found in run "${summary.runId ?? "(unknown)"}".`));
                    }

                    return okResponse({ runId: summary.runId, task });
                }

                return okResponse(summary);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                    return errorResponse(new Error(`No run summary at ${path}. Run a task first to populate it.`));
                }

                return errorResponse(error);
            }
        },
    );
};
