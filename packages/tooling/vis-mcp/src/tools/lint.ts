// eslint-disable-next-line import/no-namespace -- zod's `z` is a namespace export per zod/consistent-import
import * as z from "zod";

import { execVis } from "../exec";
import type { ToolContext, ToolDeps } from "../response";
import { errorResponse, okResponse } from "../response";

const findingSchema = z
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

const runSchema = z
    .object({
        adapter: z.string(),
        durationMs: z.number(),
        exitCode: z.number(),
        findingCount: z.number(),
    })
    .catchall(z.unknown());

const lintJsonSchema = z
    .object({
        findings: z.array(findingSchema),
        runs: z.array(runSchema),
    })
    .catchall(z.unknown());

type LintJson = z.infer<typeof lintJsonSchema>;

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
                files: z.array(z.string()).optional().describe("Restrict the run to these files (relative to the workspace root). Empty/omitted = workspace-wide."),
                maxWarnings: z.int().nonnegative().optional().describe("Forward `--max-warnings N` to every adapter that supports it."),
                quiet: z.boolean().optional().describe("Suppress warning-severity findings (errors still flow through)."),
                since: z.string().optional().describe("Forward `--since <ref>` so only files changed vs `<ref>` are linted."),
                staged: z.boolean().optional().describe("Forward `--staged` so only files in the git index are linted."),
            },
        },
        async (input: {
            files?: string[];
            maxWarnings?: number;
            quiet?: boolean;
            since?: string;
            staged?: boolean;
        }) => {
            try {
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
                    args.push("--since", input.since);
                }

                if (input.files && input.files.length > 0) {
                    args.push(...input.files);
                }

                // `vis lint` exits non-zero whenever findings exist — that's the
                // expected payload, not a tool failure. Use execVis directly so
                // we can parse stdout regardless of exit code.
                const result = await execVis(context.visBin, args, { cwd: context.workspaceRoot });

                if (result.timedOut) {
                    return errorResponse(new Error(`vis lint timed out`));
                }

                if (result.stdout.trim().length === 0) {
                    const tail = result.stderr.trim().split("\n").slice(-5).join("\n");

                    return errorResponse(new Error(`vis lint exited with code ${String(result.exitCode)} and no JSON output${tail ? `\n${tail}` : ""}`));
                }

                const raw = JSON.parse(result.stdout) as LintJson;
                const payload = lintJsonSchema.parse(raw);

                return okResponse({ ...payload, exitCode: result.exitCode });
            } catch (error) {
                return errorResponse(error);
            }
        },
    );
};
