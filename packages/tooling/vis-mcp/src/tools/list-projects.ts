// eslint-disable-next-line import/no-namespace -- zod's `z` is a namespace export per zod/consistent-import
import * as z from "zod";

import { execVisJson } from "../exec";
import type { ToolContext, ToolDeps } from "../response";
import { errorResponse, okResponse } from "../response";

export const registerListProjects = ({ server }: ToolDeps, context: ToolContext): void => {
    server.registerTool(
        "list_projects",
        {
            annotations: { readOnlyHint: true },
            description:
                'List all workspace projects with their language, type, layer, tags, and target metadata. Optionally filter with a vis query string (e.g. "tag=frontend", "type=application").',
            inputSchema: {
                query: z.string().optional().describe('Filter projects by vis query string (e.g. "tag=frontend")'),
            },
        },
        async ({ query }: { query?: string }) => {
            try {
                const args = ["list", "--json"];

                if (query) {
                    args.push("--query", query);
                }

                const projects = await execVisJson<unknown[]>(context.visBin, args, { cwd: context.workspaceRoot });

                return okResponse({ count: projects.length, projects });
            } catch (error) {
                return errorResponse(error);
            }
        },
    );
};
