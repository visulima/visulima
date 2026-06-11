// eslint-disable-next-line import/no-namespace -- zod's `z` is a namespace export per zod/consistent-import
import * as z from "zod";

import { execVisJson } from "../exec";
import type { ToolContext, ToolDeps } from "../response";
import { errorResponse, okResponse } from "../response";
import { isSafePositional } from "../validation";

interface TemplateDescription {
    [key: string]: unknown;
    description: string;
    destination?: string;
    name: string;
    path: string;
    source: "config" | "moon" | "native" | "remote";
    variables: {
        [key: string]: unknown;
        default?: boolean | number | string | string[];
        multiple?: boolean;
        name: string;
        order?: number;
        prompt?: string;
        required?: boolean;
        type: "array" | "boolean" | "enum" | "number" | "string";
        values?: string[];
    }[];
}

export const registerDescribeTemplate = ({ server }: ToolDeps, context: ToolContext): void => {
    server.registerTool(
        "describe_template",
        {
            annotations: { readOnlyHint: true },
            description:
                "Return full metadata for a scaffolding template: description, default destination, and the variable schema (name, type, default, required, prompt, enum values). Use this before suggesting a `vis generate` command so option values can be filled correctly.",
            inputSchema: {
                name: z.string().describe('Template name (e.g. "package", "component"). Use list_templates to see available names.'),
            },
        },
        async ({ name }: { name: string }) => {
            if (!isSafePositional(name)) {
                return errorResponse(new Error(`Invalid template name "${name}". A leading "-" would be parsed as a CLI flag.`));
            }

            try {
                // `--` terminates option parsing so the template name can never be
                // reinterpreted as a flag by the vis CLI.
                const description = await execVisJson<TemplateDescription>(context.visBin, ["generate", "--describe", "--json", "--", name], {
                    cwd: context.workspaceRoot,
                });

                return okResponse(description);
            } catch (error) {
                return errorResponse(error);
            }
        },
    );
};
