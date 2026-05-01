import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * MCP tool response shape used across all `vis` tools. Kept in one place so
 * adding a new tool doesn't require re-deriving the type from the SDK.
 *
 * The index signature matches the SDK's `CallToolResult` shape — the SDK
 * extends the JSON-RPC result with an open `_meta` bag and refuses anything
 * stricter at the assignment site.
 */
export interface McpToolResponse {
    [key: string]: unknown;
    content: { text: string; type: "text" }[];
    isError?: boolean;
}

export const okResponse = (payload: unknown): McpToolResponse => {
    return {
        content: [
            {
                text: typeof payload === "string" ? payload : JSON.stringify(payload),
                type: "text",
            },
        ],
    };
};

export const errorResponse = (error: unknown): McpToolResponse => {
    const message = error instanceof Error ? error.message : String(error);

    return {
        content: [
            {
                text: JSON.stringify({ error: message }),
                type: "text",
            },
        ],
        isError: true,
    };
};

export interface ToolContext {
    /** Absolute path to the resolved `vis` CLI bundle. */
    visBin: string;
    /** Workspace root the MCP server should operate against. */
    workspaceRoot: string;
}

/**
 * Dependencies a tool needs from the MCP SDK. Threaded through so each tool
 * stays a plain registration function and tests can swap in a fake `server`
 * without touching the real SDK.
 */
export interface ToolDeps {
    server: McpServer;
}
