// eslint-disable-next-line import/no-namespace -- zod's `z` is a namespace export per zod/consistent-import
import * as z from "zod";

import { listVisJson } from "../list-cache";
import type { ToolContext, ToolDeps } from "../response";
import { errorResponse, okResponse } from "../response";

interface ProjectListEntry {
    [key: string]: unknown;
    name: string;
}

export const registerDescribeProject = ({ server }: ToolDeps, context: ToolContext): void => {
    server.registerTool(
        "describe_project",
        {
            annotations: { readOnlyHint: true },
            description: "Return full metadata for a single workspace project: language, layer, stack, type, tags, root path, and all targets.",
            inputSchema: {
                name: z.string().describe('Project name (e.g. "@visulima/cerebro")'),
            },
        },
        async ({ name }: { name: string }) => {
            try {
                const projects = await listVisJson<ProjectListEntry[]>(context.visBin, context.workspaceRoot, ["list", "--json"]);
                const project = projects.find((entry) => entry.name === name);

                if (!project) {
                    return errorResponse(new Error(`No project named "${name}". Use list_projects to see available names.`));
                }

                return okResponse(project);
            } catch (error) {
                return errorResponse(error);
            }
        },
    );
};
