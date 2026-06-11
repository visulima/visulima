// eslint-disable-next-line import/no-namespace -- zod's `z` is a namespace export per zod/consistent-import
import * as z from "zod";

import { execVisJson } from "../exec";
import type { ToolContext, ToolDeps } from "../response";
import { errorResponse, okStructuredResponse } from "../response";

const ecosystemSummarySchema = z.object({
    advisoryCount: z.number(),
    lastSyncIso: z.string(),
    manifestEtag: z.string().nullable(),
    name: z.string(),
});

// `.catchall(z.unknown())` preserves unknown keys so the schema stays forward-
// compatible with new CLI fields (e.g., test fixtures' `flags`) without
// silently dropping them.
const advisoryStatusJsonSchema = z
    .object({
        dbPath: z.string(),
        ecosystems: z.array(ecosystemSummarySchema),
        exists: z.boolean(),
        schemaVersion: z.number(),
        sizeBytes: z.number(),
    })
    .catchall(z.unknown());

type AdvisoryStatusJson = z.infer<typeof advisoryStatusJsonSchema>;

// Output shape advertised to MCP clients (see audit.ts for the catchall caveat).
const advisoryStatusOutputSchema = advisoryStatusJsonSchema.shape;

export const registerAdvisoryStatus = ({ server }: ToolDeps, context: ToolContext): void => {
    server.registerTool(
        "advisory_status",
        {
            annotations: { readOnlyHint: true },
            description:
                "Report the local OSV advisory DB freshness via `vis advisories status --format json`: "
                + "DB path, schema version, per-ecosystem advisory counts, last sync timestamp, and ETag. "
                + "Use this to detect whether the offline cache is stale before running an `audit` in offline mode.",
            inputSchema: {
                db: z.string().min(1).optional().describe("Override the cache DB path (default: <cache>/vis/advisories/db.sqlite)."),
            },
            outputSchema: advisoryStatusOutputSchema,
        },
        async (input: { db?: string }) => {
            try {
                const args = ["advisories", "status", "--format", "json"];

                if (input.db !== undefined) {
                    args.push("--db", input.db);
                }

                const raw = await execVisJson<AdvisoryStatusJson>(context.visBin, args, { cwd: context.workspaceRoot });
                const payload = advisoryStatusJsonSchema.parse(raw);

                return okStructuredResponse(payload);
            } catch (error) {
                return errorResponse(error);
            }
        },
    );
};
