// eslint-disable-next-line import/no-namespace -- zod's `z` is a namespace export per zod/consistent-import
import * as z from "zod";

import { execVisJson } from "../exec";
import type { ToolContext, ToolDeps } from "../response";
import { errorResponse, okResponse } from "../response";

interface EcosystemSummary {
    advisoryCount: number;
    lastSyncIso: string;
    manifestEtag: string | null;
    name: string;
}

interface AdvisoryStatusJson {
    dbPath: string;
    ecosystems: EcosystemSummary[];
    exists: boolean;
    schemaVersion: number;
    sizeBytes: number;
}

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
                db: z
                    .string()
                    .optional()
                    .describe("Override the cache DB path (default: <cache>/vis/advisories/db.sqlite)."),
            },
        },
        async (input: { db?: string }) => {
            try {
                const args = ["advisories", "status", "--format", "json"];

                if (input.db) {
                    args.push("--db", input.db);
                }

                const payload = await execVisJson<AdvisoryStatusJson>(context.visBin, args, { cwd: context.workspaceRoot });

                return okResponse(payload);
            } catch (error) {
                return errorResponse(error);
            }
        },
    );
};
