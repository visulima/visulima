// eslint-disable-next-line import/no-namespace -- zod's `z` is a namespace export per zod/consistent-import
import * as z from "zod";

import type { ToolContext, ToolDeps } from "../response";
import { errorResponse } from "../response";
import { appendPositionalFiles, isSafeOptionValue } from "../validation";
import { findingSchema, runOrchestratorTool, runSchema } from "./orchestrator-shared";

const lintJsonSchema = z
    .object({
        findings: z.array(findingSchema),
        runs: z.array(runSchema),
    })
    .catchall(z.unknown());

// Output shape advertised to MCP clients so they can validate/render typed
// results instead of re-parsing the JSON text block. `exitCode` is appended by
// the handler; unknown adapter-specific finding keys are preserved by the
// `findingSchema.catchall` above and simply ignored by client validation.
const lintOutputSchema = {
    exitCode: z.number(),
    findings: z.array(findingSchema),
    runs: z.array(runSchema),
};

export const registerLint = ({ server }: ToolDeps, context: ToolContext): void => {
    server.registerTool(
        "lint",
        {
            annotations: { readOnlyHint: true },
            description:
                "Run the vis lint orchestrator in check-only mode via `vis lint --format json`. Auto-detects every installed "
                + "linter (oxlint, biome, eslint, stylelint, ruff, markdownlint, shellcheck, deno-lint) and returns the merged "
                + "{ findings, runs } payload. This tool never applies fixes — invoke `vis lint --fix` directly for that.",
            inputSchema: {
                files: z
                    .array(z.string())
                    .optional()
                    .describe("Restrict the run to these files (relative to the workspace root). Empty/omitted = workspace-wide."),
                maxWarnings: z.int().nonnegative().optional().describe("Forward `--max-warnings N` to every adapter that supports it."),
                quiet: z.boolean().optional().describe("Suppress warning-severity findings (errors still flow through)."),
                since: z.string().optional().describe("Forward `--since <ref>` so only files changed vs `<ref>` are linted."),
                staged: z.boolean().optional().describe("Forward `--staged` so only files in the git index are linted."),
            },
            outputSchema: lintOutputSchema,
        },
        async (input: { files?: string[]; maxWarnings?: number; quiet?: boolean; since?: string; staged?: boolean }) => {
            const args = ["lint", "--format", "json"];

            if (input.quiet) {
                args.push("--quiet");
            }

            if (typeof input.maxWarnings === "number") {
                args.push("--max-warnings", String(input.maxWarnings));
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

            return runOrchestratorTool(context, "lint", args, lintJsonSchema, (payload, exitCode) => ({ ...payload, exitCode }));
        },
    );
};
