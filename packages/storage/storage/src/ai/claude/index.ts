import type { CanUseTool, McpSdkServerConfigWithInstance, SdkMcpToolDefinition } from "@anthropic-ai/claude-agent-sdk";
import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";

import type { Files } from "../../files";
import type { ApprovalConfig } from "../internal/approval";
import { resolveApproval } from "../internal/approval";
import type { FileToolName, FileWriteToolName } from "../internal/schemas";
import { WRITE_TOOL_NAME_SET } from "../internal/schemas";
import {
    claudeCopyFile,
    claudeDeleteFile,
    claudeDownloadFile,
    claudeGetFileMetadata,
    claudeGetFileUrl,
    claudeListFiles,
    claudeSignUploadUrl,
    claudeUploadFile,
} from "./tools";
import type { ClaudeToolOverrides } from "./types";

// The per-tool factories each return SdkMcpToolDefinition with a different
// concrete generic. Function arguments on the handler are contravariant on
// the input shape, so they aren't mutually assignable through the SDK's
// public generic. We type the internal homogeneous record loosely and cast
// at the createSdkMcpServer call site, which is what the SDK does itself.
interface AnyToolDefinition {
    annotations?: NonNullable<SdkMcpToolDefinition["annotations"]>;
    description: string;
    handler: (args: never, extra: unknown) => Promise<unknown>;
    inputSchema: unknown;
    name: string;
}

export interface ClaudeFileToolsOptions {
    /**
     * The configured `Files` instance the tools will operate against.
     */
    files: Files;

    /**
     * Per-tool overrides for `description` / `annotations` without touching
     * the underlying handler or input schema.
     */
    overrides?: Partial<Record<FileToolName, ClaudeToolOverrides>>;

    /**
     * When `true`, write tools (`uploadFile`, `deleteFile`, `copyFile`,
     * `signUploadUrl`) are omitted from the MCP server. The model cannot
     * mutate the bucket regardless of approval configuration.
     */
    readOnly?: boolean;

    /**
     * Approval gating reflected by {@link ClaudeFileTools.needsApproval} and
     * the bundled {@link ClaudeFileTools.canUseTool}. Defaults to `true`
     * (every write requires approval). Pass `false` to disable, or an object
     * keyed by write-tool name for fine-grained control.
     */
    requireApproval?: ApprovalConfig;

    /**
     * Name of the in-process MCP server that wraps these tools. Affects the
     * `mcp__&lt;server-name>__&lt;tool-name>` strings the agent uses to address
     * each tool. Defaults to `"files"`.
     */
    serverName?: string;

    /**
     * MCP server `version` metadata. Defaults to `"1.0.0"`.
     */
    serverVersion?: string;
}

export interface ClaudeFileTools {
    /**
     * Pass into `query({ options: { allowedTools: tools.allowedTools } })`.
     * Each entry is of the form `mcp__&lt;serverName>__&lt;toolName>`.
     */
    allowedTools: string[];

    /**
     * Ready-made `canUseTool` callback. Allows reads unconditionally, allows
     * writes whose `needsApproval` resolves to `false`, denies the rest with
     * a `"requires approval"` message. Pass directly into `query()`, or
     * compose your own using {@link ClaudeFileTools.needsApproval}.
     */
    canUseTool: CanUseTool;

    /**
     * Pass into `query({ options: { mcpServers: tools.mcpServers } })`.
     */
    mcpServers: Record<string, McpSdkServerConfigWithInstance>;

    /**
     * Whether the named tool is approval-gated under the configured
     * `requireApproval`. Accepts both bare names (`"uploadFile"`) and the
     * MCP-prefixed form (`"mcp__files__uploadFile"`). Read tools and unknown
     * names return `false`.
     */
    needsApproval: (toolName: string) => boolean;

    /**
     * The raw SDK MCP server instance — same value as
     * `mcpServers[serverName]`. Exposed for callers that want to compose it
     * into a larger `mcpServers` map.
     */
    server: McpSdkServerConfigWithInstance;

    /**
     * The MCP server name used in the `mcp__&lt;server>__*` prefix.
     */
    serverName: string;
}

const DEFAULT_SERVER_NAME = "files";
const DEFAULT_SERVER_VERSION = "1.0.0";

const isWriteTool = (name: string): name is FileWriteToolName => WRITE_TOOL_NAME_SET.has(name as FileWriteToolName);

/**
 * Create storage tools shaped for the Claude Agent SDK
 * (`@anthropic-ai/claude-agent-sdk`).
 *
 * The Claude Agent SDK consumes tools by way of an in-process MCP server +
 * an `allowedTools` allow-list + a `canUseTool` approval callback. The
 * returned bundle gives you all three, plus the raw server instance and a
 * `needsApproval()` helper if you want to wire your own `canUseTool`.
 * @example
 * ```ts
 * import { query } from "@anthropic-ai/claude-agent-sdk";
 * import { Files } from "@visulima/storage";
 * import { S3Storage } from "@visulima/storage/provider/aws";
 * import { createClaudeFileTools } from "@visulima/storage/ai/claude";
 *
 * const files = new Files({ adapter: new S3Storage({ bucket: "uploads" }) });
 * const tools = createClaudeFileTools({ files });
 *
 * for await (const message of query({
 *   prompt: "List my files.",
 *   options: {
 *     mcpServers: tools.mcpServers,
 *     allowedTools: tools.allowedTools,
 *     canUseTool: tools.canUseTool,
 *   },
 * })) {
 *   // handle messages
 * }
 * ```
 * @example Read-only agent
 * ```ts
 * createClaudeFileTools({ files, readOnly: true })
 * ```
 * @example Granular approval
 * ```ts
 * createClaudeFileTools({
 *   files,
 *   requireApproval: {
 *     copyFile: false,
 *     deleteFile: true,
 *     signUploadUrl: true,
 *     uploadFile: false,
 *   },
 * })
 * ```
 */
export const createClaudeFileTools = ({
    files,
    overrides,
    readOnly = false,
    requireApproval = true,
    serverName = DEFAULT_SERVER_NAME,
    serverVersion = DEFAULT_SERVER_VERSION,
}: ClaudeFileToolsOptions): ClaudeFileTools => {
    const allTools: Record<FileToolName, AnyToolDefinition> = {
        copyFile: claudeCopyFile(files),
        deleteFile: claudeDeleteFile(files),
        downloadFile: claudeDownloadFile(files),
        getFileMetadata: claudeGetFileMetadata(files),
        getFileUrl: claudeGetFileUrl(files),
        listFiles: claudeListFiles(files),
        signUploadUrl: claudeSignUploadUrl(files),
        uploadFile: claudeUploadFile(files),
    };

    if (overrides) {
        for (const [name, toolOverrides] of Object.entries(overrides)) {
            if (name in allTools && toolOverrides) {
                const key = name as FileToolName;

                allTools[key] = { ...allTools[key], ...toolOverrides };
            }
        }
    }

    const includedTools = (Object.entries(allTools) as [FileToolName, AnyToolDefinition][]).filter(
        ([name]) => !(readOnly && isWriteTool(name)),
    );

    const prefix = `mcp__${serverName}__`;
    const stripPrefix = (name: string): string => (name.startsWith(prefix) ? name.slice(prefix.length) : name);

    const includedSet: ReadonlySet<string> = new Set(includedTools.map(([name]) => name));

    const needsApproval = (toolName: string): boolean => {
        const bare = stripPrefix(toolName);

        if (!includedSet.has(bare)) {
            return false;
        }

        if (!isWriteTool(bare)) {
            return false;
        }

        return resolveApproval(bare, requireApproval);
    };

    const canUseTool: CanUseTool = (toolName, input) =>
        Promise.resolve(
            needsApproval(toolName)
                ? {
                    behavior: "deny",
                    message: `Tool "${toolName}" requires approval.`,
                }
                : { behavior: "allow", updatedInput: input },
        );

    const server = createSdkMcpServer({
        name: serverName,
        tools: includedTools.map(([, t]) => t) as unknown as Parameters<typeof createSdkMcpServer>[0]["tools"],
        version: serverVersion,
    });

    return {
        allowedTools: includedTools.map(([name]) => `${prefix}${name}`),
        canUseTool,
        mcpServers: { [serverName]: server },
        needsApproval,
        server,
        serverName,
    };
};

export { type ApprovalConfig } from "../internal/approval";
export { type FileReadToolName, type FileToolName, type FileWriteToolName } from "../internal/schemas";
export type { ClaudeWriteToolOptions } from "./tools";
export {
    claudeCopyFile,
    claudeDeleteFile,
    claudeDownloadFile,
    claudeGetFileMetadata,
    claudeGetFileUrl,
    claudeListFiles,
    claudeSignUploadUrl,
    claudeUploadFile,
} from "./tools";
export type { ClaudeToolOverrides, ToolAnnotations } from "./types";
