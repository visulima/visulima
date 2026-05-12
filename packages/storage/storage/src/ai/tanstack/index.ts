import type { Files } from "../../files";
import type { ApprovalConfig } from "../internal/approval";
import { resolveApproval } from "../internal/approval";
import type { FileReadToolName, FileToolName, FileWriteToolName } from "../internal/schemas";
import { WRITE_TOOL_NAME_SET } from "../internal/schemas";
import { copyFile, deleteFile, downloadFile, getFileMetadata, getFileUrl, listFiles, signUploadUrl, uploadFile } from "./tools";
import type { ToolOverrides } from "./types";

export type { ApprovalConfig } from "../internal/approval";
export type { FileReadToolName, FileToolName, FileWriteToolName } from "../internal/schemas";

export interface TanstackFileToolsOptions {
    /**
     * The configured `Files` instance the tools will operate against.
     * Each tool delegates to the methods on this instance.
     */
    files: Files;

    /**
     * Per-tool overrides for customizing tool behavior (description,
     * needsApproval, metadata) without changing the underlying implementation.
     * `execute` and `inputSchema` cannot be overridden.
     */
    overrides?: Partial<Record<FileToolName, ToolOverrides>>;

    /**
     * When `true`, write tools (`uploadFile`, `deleteFile`, `copyFile`,
     * `signUploadUrl`) are omitted entirely. The model cannot mutate the
     * bucket regardless of approval configuration.
     */
    readOnly?: boolean;

    /**
     * Approval gating for write tools. Defaults to `true` (all writes
     * require approval). See {@link ApprovalConfig}.
     */
    requireApproval?: ApprovalConfig;
}

export interface TanstackFileTools {
    copyFile: ReturnType<typeof copyFile>;
    deleteFile: ReturnType<typeof deleteFile>;
    downloadFile: ReturnType<typeof downloadFile>;
    getFileMetadata: ReturnType<typeof getFileMetadata>;
    getFileUrl: ReturnType<typeof getFileUrl>;
    listFiles: ReturnType<typeof listFiles>;
    signUploadUrl: ReturnType<typeof signUploadUrl>;
    uploadFile: ReturnType<typeof uploadFile>;
}

export type ReadOnlyTanstackFileTools = Pick<TanstackFileTools, FileReadToolName>;

/**
 * Create a set of visulima/storage tools for TanStack AI.
 *
 * Each entry is a `ServerTool` built via `toolDefinition(...).server(...)`,
 * ready to be passed to `chat({ tools: [...] })` or registered with a
 * `ToolRegistry`. Write operations require user approval by default;
 * control globally or per-tool via `requireApproval`, or strip writes
 * entirely with `readOnly: true`.
 * @example
 * ```ts
 * import { Files } from "@visulima/storage";
 * import { S3Storage } from "@visulima/storage/provider/aws";
 * import { createTanstackFileTools } from "@visulima/storage/ai/tanstack";
 * import { chat } from "@tanstack/ai";
 *
 * const files = new Files({ adapter: new S3Storage({ bucket: "uploads" }) });
 * const tools = createTanstackFileTools({ files });
 *
 * const stream = chat({
 *   adapter,
 *   messages,
 *   tools: Object.values(tools),
 * });
 * ```
 */
export function createTanstackFileTools(options: TanstackFileToolsOptions & { readOnly: true }): ReadOnlyTanstackFileTools;
export function createTanstackFileTools(options: TanstackFileToolsOptions & { readOnly?: false | undefined }): TanstackFileTools;
export function createTanstackFileTools(options: TanstackFileToolsOptions): ReadOnlyTanstackFileTools | TanstackFileTools;
export function createTanstackFileTools({
    files,
    overrides,
    readOnly = false,
    requireApproval = true,
}: TanstackFileToolsOptions): ReadOnlyTanstackFileTools | TanstackFileTools {
    const approval = (name: FileWriteToolName) => {
        return {
            needsApproval: resolveApproval(name, requireApproval),
        };
    };

    const allTools: TanstackFileTools = {
        copyFile: copyFile(files, approval("copyFile")),
        deleteFile: deleteFile(files, approval("deleteFile")),
        downloadFile: downloadFile(files),
        getFileMetadata: getFileMetadata(files),
        getFileUrl: getFileUrl(files),
        listFiles: listFiles(files),
        signUploadUrl: signUploadUrl(files, approval("signUploadUrl")),
        uploadFile: uploadFile(files, approval("uploadFile")),
    };

    if (overrides) {
        for (const [name, toolOverrides] of Object.entries(overrides)) {
            if (name in allTools && toolOverrides) {
                const key = name as keyof TanstackFileTools;

                Object.assign(allTools, {
                    [key]: { ...allTools[key], ...toolOverrides },
                });
            }
        }
    }

    if (!readOnly) {
        return allTools;
    }

    return Object.fromEntries(
        Object.entries(allTools).filter(([name]) => !WRITE_TOOL_NAME_SET.has(name as FileWriteToolName)),
    ) as ReadOnlyTanstackFileTools;
}

export { copyFile, deleteFile, downloadFile, getFileMetadata, getFileUrl, listFiles, signUploadUrl, uploadFile } from "./tools";
export type { ToolOptions, ToolOverrides } from "./types";
