// eslint-disable-next-line import/no-namespace -- zod's `z` is a namespace export per zod/consistent-import
import * as z from "zod";

import { execVisJson } from "../exec";
import type { ToolContext, ToolDeps } from "../response";
import { errorResponse, okResponse } from "../response";
import { isValidRunId, isValidTaskId } from "../validation";

export const registerCacheHash = ({ server }: ToolDeps, context: ToolContext): void => {
    server.registerTool(
        "cache_hash",
        {
            annotations: { readOnlyHint: true },
            description:
                "Print the recorded hash and per-input hash details for a task — the contributing inputs (command, nodes, runtime, implicitDeps) that produced it.",
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
                const args = ["cache", "hash", taskId, "--format=json"];

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
