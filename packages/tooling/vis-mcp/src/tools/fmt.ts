// eslint-disable-next-line import/no-namespace -- zod's `z` is a namespace export per zod/consistent-import
import * as z from "zod";

import { execVis } from "../exec";
import type { ToolContext, ToolDeps } from "../response";
import { errorResponse, okStructuredResponse } from "../response";
import { appendPositionalFiles } from "../validation";

const findingSchema = z
    .object({
        adapter: z.string(),
        column: z.number().optional(),
        file: z.string(),
        fixable: z.boolean().optional(),
        line: z.number().optional(),
        message: z.string(),
        ruleId: z.string().optional(),
        severity: z.enum(["error", "info", "warning"]),
    })
    .catchall(z.unknown());

const runSchema = z
    .object({
        adapter: z.string(),
        durationMs: z.number(),
        exitCode: z.number(),
        findingCount: z.number(),
    })
    .catchall(z.unknown());

const fmtJsonSchema = z
    .object({
        findings: z.array(findingSchema),
        mode: z.enum(["check", "fix"]).optional(),
        runs: z.array(runSchema),
    })
    .catchall(z.unknown());

// Output shape advertised to MCP clients. `exitCode` and a normalized `mode` are
// appended by the handler; unknown finding keys are tolerated by client
// validation (zod object validation ignores extras it doesn't know about).
const fmtOutputSchema = {
    exitCode: z.number(),
    findings: z.array(findingSchema),
    mode: z.enum(["check", "fix"]),
    runs: z.array(runSchema),
};

export const registerFmt = ({ server }: ToolDeps, context: ToolContext): void => {
    server.registerTool(
        "fmt",
        {
            annotations: { readOnlyHint: true },
            description:
                "Run the vis fmt orchestrator in --check mode via `vis fmt --check --format json`. Auto-detects every "
                + "installed formatter (oxfmt, biome, dprint, prettier, ruff-fmt, deno-fmt) and returns the merged "
                + "{ findings, runs } payload — each finding represents a file that would change. This tool never writes "
                + "to disk; invoke `vis fmt` directly to apply the formatting.",
            inputSchema: {
                files: z
                    .array(z.string())
                    .optional()
                    .describe("Restrict the check to these files (relative to the workspace root). Empty/omitted = workspace-wide."),
                quiet: z.boolean().optional().describe("Suppress per-file logs (findings still flow through)."),
                since: z.string().optional().describe("Forward `--since <ref>` so only files changed vs `<ref>` are checked."),
                staged: z.boolean().optional().describe("Forward `--staged` so only files in the git index are checked."),
            },
            outputSchema: fmtOutputSchema,
        },
        async (input: { files?: string[]; quiet?: boolean; since?: string; staged?: boolean }) => {
            try {
                const args = ["fmt", "--check", "--format", "json"];

                if (input.quiet) {
                    args.push("--quiet");
                }

                if (input.staged) {
                    args.push("--staged");
                } else if (input.since !== undefined && input.since.length > 0) {
                    args.push("--since", input.since);
                }

                const fileError = appendPositionalFiles(args, input.files);

                if (fileError !== undefined) {
                    return errorResponse(new Error(fileError));
                }

                // `vis fmt --check` exits 1 when files would change — that's the
                // expected payload, not a tool failure. execVis lets us parse
                // stdout regardless of exit code.
                const result = await execVis(context.visBin, args, { cwd: context.workspaceRoot });

                if (result.timedOut) {
                    return errorResponse(new Error(`vis fmt timed out`));
                }

                if (result.overflowed) {
                    return errorResponse(new Error(`vis fmt produced more output than the buffer ceiling allows and was killed`));
                }

                if (result.stdout.trim().length === 0) {
                    const tail = result.stderr.trim().split("\n").slice(-5).join("\n");

                    return errorResponse(new Error(`vis fmt exited with code ${String(result.exitCode)} and no JSON output${tail ? `\n${tail}` : ""}`));
                }

                let raw: unknown;

                try {
                    raw = JSON.parse(result.stdout);
                } catch (error) {
                    return errorResponse(
                        new Error(`vis ${args.join(" ")} did not emit valid JSON: ${error instanceof Error ? error.message : String(error)}`, { cause: error }),
                    );
                }

                const payload = fmtJsonSchema.parse(raw);

                return okStructuredResponse({ ...payload, exitCode: result.exitCode, mode: payload.mode ?? "check" });
            } catch (error) {
                return errorResponse(error);
            }
        },
    );
};
