import type { FileWriteToolName } from "./schemas";

/**
 * Whether write operations require user approval.
 *
 * - `true` — all write tools need approval (default)
 * - `false` — no approval needed for any write tool
 * - object — per-tool override; unspecified write tools default to `true`
 */
export type ApprovalConfig = boolean | Partial<Record<FileWriteToolName, boolean>>;

export const resolveApproval = (toolName: FileWriteToolName, config: ApprovalConfig): boolean => {
    if (typeof config === "boolean") {
        return config;
    }

    return config[toolName] ?? true;
};
