// eslint-disable-next-line import/no-namespace -- zod's `z` is a namespace export per zod/consistent-import
import * as z from "zod";

import { execVis } from "../exec";
import type { McpToolResponse, ToolContext } from "../response";
import { errorResponse, okStructuredResponse } from "../response";

// Shared by the `lint` and `fmt` tools, which both wrap the vis lint/fmt
// orchestrators. `vis` emits one Finding interface for both subcommands, so the
// schema must stay identical here — keeping it in one place stops the two tools
// from silently drifting (fmt previously lacked `endColumn`/`endLine`).
export const findingSchema = z
    .object({
        adapter: z.string(),
        column: z.number().optional(),
        endColumn: z.number().optional(),
        endLine: z.number().optional(),
        file: z.string(),
        fixable: z.boolean().optional(),
        line: z.number().optional(),
        message: z.string(),
        ruleId: z.string().optional(),
        severity: z.enum(["error", "info", "warning"]),
    })
    .catchall(z.unknown());

export const runSchema = z
    .object({
        adapter: z.string(),
        durationMs: z.number(),
        exitCode: z.number(),
        findingCount: z.number(),
    })
    .catchall(z.unknown());

/**
 * Run a vis lint/fmt orchestrator invocation and drive the shared result
 * pipeline: timed-out / overflowed / empty-stdout guards, `JSON.parse`, and a
 * zod parse against `schema`. On success the parsed payload and the process
 * exit code are handed to `finalize`, whose object becomes the structured tool
 * response. Any failure is surfaced as an `errorResponse`.
 */
export const runOrchestratorTool = async <T extends Record<string, unknown>>(
    context: ToolContext,
    commandWord: string,
    args: string[],
    schema: z.ZodType<T>,
    finalize: (payload: T, exitCode: number) => Record<string, unknown>,
): Promise<McpToolResponse> => {
    try {
        // `vis lint`/`vis fmt --check` exit non-zero whenever findings exist —
        // that's the expected payload, not a tool failure. Use execVis directly
        // so we can parse stdout regardless of exit code.
        const result = await execVis(context.visBin, args, { cwd: context.workspaceRoot });

        if (result.timedOut) {
            return errorResponse(new Error(`vis ${commandWord} timed out`));
        }

        if (result.overflowed) {
            return errorResponse(new Error(`vis ${commandWord} produced more output than the buffer ceiling allows and was killed`));
        }

        if (result.stdout.trim().length === 0) {
            const tail = result.stderr.trim().split("\n").slice(-5).join("\n");

            return errorResponse(new Error(`vis ${commandWord} exited with code ${String(result.exitCode)} and no JSON output${tail ? `\n${tail}` : ""}`));
        }

        let raw: unknown;

        try {
            raw = JSON.parse(result.stdout);
        } catch (error) {
            return errorResponse(
                new Error(`vis ${args.join(" ")} did not emit valid JSON: ${error instanceof Error ? error.message : String(error)}`, { cause: error }),
            );
        }

        const payload = schema.parse(raw);

        return okStructuredResponse(finalize(payload, result.exitCode));
    } catch (error) {
        return errorResponse(error);
    }
};
