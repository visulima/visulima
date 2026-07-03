import type { Files } from "../../files";
import type { ApprovalConfig } from "../internal/approval";
import { resolveApproval } from "../internal/approval";
import { executors } from "../internal/executors";
import { toOpenAiJsonSchema } from "../internal/json-schema";
import type { FileToolName, FileWriteToolName } from "../internal/schemas";
import { TOOL_SCHEMAS, WRITE_TOOL_NAME_SET } from "../internal/schemas";
import type { ResponsesToolOverrides } from "./types";

/**
 * A function-tool definition shaped for OpenAI's Responses API. Pass an
 * array of these to `openai.responses.create({ tools })`.
 */
export interface ResponsesFunctionTool {
    description: string;
    name: string;
    parameters: Record<string, unknown>;
    strict: boolean;
    type: "function";
}

/**
 * A function call emitted by the Responses API in `response.output[]`.
 */
export interface FunctionCallItem {
    arguments: string;
    call_id: string;
    name: string;
    type: "function_call";
}

/**
 * A function-call output item to append to the next `responses.create`
 * input alongside the original `function_call` item.
 */
export interface FunctionCallOutputItem {
    call_id: string;
    output: string;
    type: "function_call_output";
}

export interface ResponsesFileTools {
    /**
     * Function tool definitions. Pass directly to `openai.responses.create({ tools })`.
     */
    definitions: ResponsesFunctionTool[];

    /**
     * Execute a `function_call` item from the model's `response.output[]`.
     * Returns a `function_call_output` item ready to push into the next turn's input.
     *
     * Approval is **not** enforced. Check {@link ResponsesFileTools.needsApproval}
     * first if you want a human-in-the-loop gate.
     */
    execute: (call: FunctionCallItem) => Promise<FunctionCallOutputItem>;

    /**
     * Returns whether the named tool is approval-gated under this config.
     * Read tools always return `false`. Unknown names return `false`.
     */
    needsApproval: (name: string) => boolean;
}

export interface ResponsesFileToolsOptions {
    files: Files;

    overrides?: Partial<Record<FileToolName, ResponsesToolOverrides>>;

    readOnly?: boolean;

    requireApproval?: ApprovalConfig;
}

const TOOL_NAMES: ReadonlyArray<FileToolName> = [
    "listFiles",
    "getFileMetadata",
    "downloadFile",
    "getFileUrl",
    "uploadFile",
    "deleteFile",
    "copyFile",
    "signUploadUrl",
];

const isWriteTool = (name: string): name is FileWriteToolName => WRITE_TOOL_NAME_SET.has(name as FileWriteToolName);

type DispatchResult = { issues: unknown; ok: false } | { ok: true; output: unknown };

const dispatch = async (files: Files, name: FileToolName, args: unknown): Promise<DispatchResult> => {
    const schema = TOOL_SCHEMAS[name].input;
    const validated = schema.safeParse(args);

    if (!validated.success) {
        return { issues: validated.error.issues, ok: false };
    }

    switch (name) {
        case "copyFile": {
            return { ok: true, output: await executors.copyFile(files, validated.data as never) };
        }
        case "deleteFile": {
            return { ok: true, output: await executors.deleteFile(files, validated.data as never) };
        }
        case "downloadFile": {
            return { ok: true, output: await executors.downloadFile(files, validated.data as never) };
        }
        case "getFileMetadata": {
            return { ok: true, output: await executors.getFileMetadata(files, validated.data as never) };
        }
        case "getFileUrl": {
            return { ok: true, output: await executors.getFileUrl(files, validated.data as never) };
        }
        case "listFiles": {
            return { ok: true, output: await executors.listFiles(files, validated.data as never) };
        }
        case "signUploadUrl": {
            return { ok: true, output: await executors.signUploadUrl(files, validated.data as never) };
        }
        case "uploadFile": {
            return { ok: true, output: await executors.uploadFile(files, validated.data as never) };
        }
        default: {
            const exhaustive: never = name;

            throw new Error(`Unhandled tool: ${String(exhaustive)}`);
        }
    }
};

/**
 * Create a set of storage tools shaped for OpenAI's Responses API (`openai.responses.create`).
 * @example
 * ```ts
 * import OpenAI from "openai";
 * import { Files } from "@visulima/storage";
 * import { S3Storage } from "@visulima/storage/provider/aws";
 * import { createResponsesFileTools } from "@visulima/storage/ai/openai";
 *
 * const client = new OpenAI();
 * const files = new Files({ adapter: new S3Storage({ bucket: "uploads" }) });
 * const ft = createResponsesFileTools({ files });
 *
 * const input: any[] = [{ role: "user", content: "List my files." }];
 * while (true) {
 *   const res = await client.responses.create({ model: "gpt-4.1", input, tools: ft.definitions });
 *   const calls = res.output.filter((o) => o.type === "function_call");
 *   if (calls.length === 0) break;
 *   for (const call of calls) {
 *     if (ft.needsApproval(call.name)) {
 *       // surface approval UX, then continue or break
 *     }
 *     input.push(call, await ft.execute(call));
 *   }
 * }
 * ```
 */
export const createResponsesFileTools = ({ files, overrides, readOnly = false, requireApproval = true }: ResponsesFileToolsOptions): ResponsesFileTools => {
    const includedNames = TOOL_NAMES.filter((name) => !(readOnly && isWriteTool(name)));

    const approvalFor = (name: string): boolean => {
        if (!isWriteTool(name)) {
            return false;
        }

        return resolveApproval(name, requireApproval);
    };

    const definitions: ResponsesFunctionTool[] = includedNames.map((name) => {
        const schema = TOOL_SCHEMAS[name];
        const override = overrides?.[name];

        return {
            description: override?.description ?? schema.description,
            name,
            parameters: toOpenAiJsonSchema(schema.input),
            strict: override?.strict ?? false,
            type: "function",
        };
    });

    const includedSet: ReadonlySet<FileToolName> = new Set(includedNames);

    const execute = async (call: FunctionCallItem): Promise<FunctionCallOutputItem> => {
        const wrap = (output: unknown): FunctionCallOutputItem => {
            return {
                call_id: call.call_id,
                output: typeof output === "string" ? output : JSON.stringify(output),
                type: "function_call_output",
            };
        };

        if (!includedSet.has(call.name as FileToolName)) {
            return wrap({ error: `Unknown tool: ${call.name}` });
        }

        let parsedArgs: unknown;

        try {
            parsedArgs = JSON.parse(call.arguments);
        } catch (error) {
            return wrap({ error: `Invalid JSON in arguments: ${(error as Error).message}` });
        }

        const result = await dispatch(files, call.name as FileToolName, parsedArgs);

        if (!result.ok) {
            return wrap({ error: "Argument validation failed", issues: result.issues });
        }

        return wrap(result.output);
    };

    return {
        definitions,
        execute,
        needsApproval: approvalFor,
    };
};
