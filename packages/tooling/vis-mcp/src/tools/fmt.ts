// eslint-disable-next-line import/no-namespace -- zod's `z` is a namespace export per zod/consistent-import
import * as z from "zod";

import type { ToolContext, ToolDeps } from "../response";
import { errorResponse } from "../response";
import { appendPositionalFiles, isSafeOptionValue } from "../validation";
import { findingSchema, runOrchestratorTool, runSchema } from "./orchestrator-shared";

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
            const args = ["fmt", "--check", "--format", "json"];

            if (input.quiet) {
                args.push("--quiet");
            }

            if (input.staged) {
                args.push("--staged");
            } else if (input.since !== undefined && input.since.length > 0) {
                if (!isSafeOptionValue(input.since)) {
                    return errorResponse(new Error(`Invalid --since value "${input.since}". A leading "-" would be parsed as a CLI flag.`));
                }

                args.push("--since", input.since);
            }

            const fileError = appendPositionalFiles(args, input.files);

            if (fileError !== undefined) {
                return errorResponse(new Error(fileError));
            }

            return runOrchestratorTool(context, "fmt", args, fmtJsonSchema, (payload, exitCode) => ({ ...payload, exitCode, mode: payload.mode ?? "check" }));
        },
    );
};
