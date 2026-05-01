// eslint-disable-next-line import/no-namespace -- zod's `z` is a namespace export per zod/consistent-import
import * as z from "zod";

import { execVisJson } from "../exec";
import type { ToolContext, ToolDeps } from "../response";
import { errorResponse, okResponse } from "../response";
import { isValidRunId, isValidTaskId } from "../validation";

export const registerCacheWhy = ({ server }: ToolDeps, context: ToolContext): void => {
    server.registerTool(
        "cache_why",
        {
            annotations: { readOnlyHint: true },
            description:
                "Explain why a task's cache hash rotated between runs. Diffs the task's hashDetails (command, nodes, runtime, implicitDeps) against the previous run to pinpoint what changed.",
            inputSchema: {
                runId: z.string().optional().describe("Run ID to inspect (default: latest)"),
                taskId: z.string().describe('Task ID like "@my/app:build"'),
            },
        },
        async ({ runId, taskId }: { runId?: string; taskId: string }) => {
            if (!isValidTaskId(taskId)) {
                return errorResponse(new Error(`Invalid taskId "${taskId}". Expected "<project>:<target>".`));
            }

            if (runId !== undefined && !isValidRunId(runId)) {
                return errorResponse(new Error(`Invalid runId "${runId}". Expected filesystem-safe slug ([A-Za-z0-9_.-]).`));
            }

            try {
                const args = ["cache", "why", taskId, "--format=json"];

                if (runId) {
                    args.push("--run", runId);
                }

                const result = await execVisJson<unknown>(context.visBin, args, { cwd: context.workspaceRoot });

                return okResponse(result);
            } catch (error) {
                return errorResponse(error);
            }
        },
    );
};
