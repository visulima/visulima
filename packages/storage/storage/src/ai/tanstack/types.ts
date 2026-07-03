import type { ServerTool } from "@tanstack/ai";

/**
 * Common options accepted by every write-tool factory.
 */
export interface ToolOptions {
    needsApproval?: boolean;
}

/**
 * Per-tool overrides for customizing TanStack AI `ServerTool` properties
 * without changing the underlying implementation. Core properties
 * (`execute`, `inputSchema`, `outputSchema`, `__toolSide`) are intentionally
 * excluded — those drive the tool's behavior and contract.
 */
export type ToolOverrides = Partial<Pick<ServerTool, "description" | "lazy" | "metadata" | "needsApproval">>;
