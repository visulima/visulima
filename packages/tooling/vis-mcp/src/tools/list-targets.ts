// eslint-disable-next-line import/no-namespace -- zod's `z` is a namespace export per zod/consistent-import
import * as z from "zod";

import { execVisJson } from "../exec";
import type { ToolContext, ToolDeps } from "../response";
import { errorResponse, okResponse } from "../response";

interface ProjectListEntry {
    [key: string]: unknown;
    name: string;
    targets?: { [key: string]: unknown; name: string }[];
}

export const registerListTargets = ({ server }: ToolDeps, context: ToolContext): void => {
    server.registerTool(
        "list_targets",
        {
            annotations: { readOnlyHint: true },
            description:
                "List per-target rows across the workspace: which targets each project exposes, with type, command, and description. Optionally narrow to a single project.",
            inputSchema: {
                project: z.string().optional().describe('Limit to one project (e.g. "@visulima/cerebro")'),
            },
        },
        async ({ project }: { project?: string }) => {
            try {
                const projects = await execVisJson<ProjectListEntry[]>(context.visBin, ["list", "--targets", "--json"], { cwd: context.workspaceRoot });
                const filtered = project ? projects.filter((entry) => entry.name === project) : projects;

                if (project && filtered.length === 0) {
                    return errorResponse(new Error(`No project named "${project}". Use list_projects to see available names.`));
                }

                const rows = filtered.flatMap((entry) =>
                    (entry.targets ?? []).map((target) => {
                        return {
                            project: entry.name,
                            target: target.name,
                            ...target,
                        };
                    }),
                );

                return okResponse({ count: rows.length, targets: rows });
            } catch (error) {
                return errorResponse(error);
            }
        },
    );
};
