import { execVisJson } from "../exec";
import type { ToolContext, ToolDeps } from "../response";
import { errorResponse, okResponse } from "../response";

interface TemplateListEntry {
    [key: string]: unknown;
    description?: string;
    name: string;
    path: string;
    source: "config" | "moon" | "native" | "remote";
}

export const registerListTemplates = ({ server }: ToolDeps, context: ToolContext): void => {
    server.registerTool(
        "list_templates",
        {
            annotations: { readOnlyHint: true },
            description:
                "List scaffolding templates discovered in the workspace (`.vis/templates/`, `.moon/templates/`, and `vis.config.ts` `generator.templates`). Each entry includes name, source, on-disk path, and one-line description.",
            inputSchema: {},
        },
        async () => {
            try {
                const templates = await execVisJson<TemplateListEntry[]>(context.visBin, ["generate", "--list", "--json"], { cwd: context.workspaceRoot });

                return okResponse({ count: templates.length, templates });
            } catch (error) {
                return errorResponse(error);
            }
        },
    );
};
