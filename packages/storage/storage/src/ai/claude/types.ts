import type { SdkMcpToolDefinition } from "@anthropic-ai/claude-agent-sdk";

/**
 * MCP tool annotations as accepted by `tool()` and exposed on
 * `SdkMcpToolDefinition`. Re-derived from the SDK rather than imported from
 * `@modelcontextprotocol/sdk` directly to avoid taking on a second peer
 * dependency.
 */
export type ToolAnnotations = NonNullable<SdkMcpToolDefinition["annotations"]>;

/**
 * Per-tool overrides for `createClaudeFileTools`. `name`, `inputSchema`, and
 * `handler` are intentionally not overridable — the contract that drives tool
 * behavior should not be patched at this layer.
 */
export interface ClaudeToolOverrides {
    annotations?: ToolAnnotations;
    description?: string;
}
