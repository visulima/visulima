import type { FunctionTool, UnknownContext } from "@openai/agents";
import { tool } from "@openai/agents";

import type { Files } from "../../files";
import type { ApprovalConfig } from "../internal/approval";
import { resolveApproval } from "../internal/approval";
import { executors } from "../internal/executors";
import type { FileReadToolName, FileToolName, FileWriteToolName } from "../internal/schemas";
import { TOOL_SCHEMAS, WRITE_TOOL_NAME_SET } from "../internal/schemas";
import type { AgentsToolOverrides } from "./types";

type ListFilesOutput = Awaited<ReturnType<typeof executors.listFiles>>;
type GetFileMetadataOutput = Awaited<ReturnType<typeof executors.getFileMetadata>>;
type DownloadFileOutput = Awaited<ReturnType<typeof executors.downloadFile>>;
type GetFileUrlOutput = Awaited<ReturnType<typeof executors.getFileUrl>>;
type UploadFileOutput = Awaited<ReturnType<typeof executors.uploadFile>>;
type DeleteFileOutput = Awaited<ReturnType<typeof executors.deleteFile>>;
type CopyFileOutput = Awaited<ReturnType<typeof executors.copyFile>>;
type SignUploadUrlOutput = Awaited<ReturnType<typeof executors.signUploadUrl>>;

type ListFilesParameters = typeof TOOL_SCHEMAS.listFiles.input;
type GetFileMetadataParameters = typeof TOOL_SCHEMAS.getFileMetadata.input;
type DownloadFileParameters = typeof TOOL_SCHEMAS.downloadFile.input;
type GetFileUrlParameters = typeof TOOL_SCHEMAS.getFileUrl.input;
type UploadFileParameters = typeof TOOL_SCHEMAS.uploadFile.input;
type DeleteFileParameters = typeof TOOL_SCHEMAS.deleteFile.input;
type CopyFileParameters = typeof TOOL_SCHEMAS.copyFile.input;
type SignUploadUrlParameters = typeof TOOL_SCHEMAS.signUploadUrl.input;

export const agentsListFiles = (files: Files): FunctionTool<UnknownContext, ListFilesParameters, ListFilesOutput> =>
    tool({
        description: TOOL_SCHEMAS.listFiles.description,
        execute: (input) => executors.listFiles(files, input),
        name: "listFiles",
        parameters: TOOL_SCHEMAS.listFiles.input,
    });

export const agentsGetFileMetadata = (files: Files): FunctionTool<UnknownContext, GetFileMetadataParameters, GetFileMetadataOutput> =>
    tool({
        description: TOOL_SCHEMAS.getFileMetadata.description,
        execute: (input) => executors.getFileMetadata(files, input),
        name: "getFileMetadata",
        parameters: TOOL_SCHEMAS.getFileMetadata.input,
    });

export const agentsDownloadFile = (files: Files): FunctionTool<UnknownContext, DownloadFileParameters, DownloadFileOutput> =>
    tool({
        description: TOOL_SCHEMAS.downloadFile.description,
        execute: (input) => executors.downloadFile(files, input),
        name: "downloadFile",
        parameters: TOOL_SCHEMAS.downloadFile.input,
    });

export const agentsGetFileUrl = (files: Files): FunctionTool<UnknownContext, GetFileUrlParameters, GetFileUrlOutput> =>
    tool({
        description: TOOL_SCHEMAS.getFileUrl.description,
        execute: (input) => executors.getFileUrl(files, input),
        name: "getFileUrl",
        parameters: TOOL_SCHEMAS.getFileUrl.input,
    });

export const agentsUploadFile = (
    files: Files,
    { needsApproval = true }: { needsApproval?: boolean } = {},
): FunctionTool<UnknownContext, UploadFileParameters, UploadFileOutput> =>
    tool({
        description: TOOL_SCHEMAS.uploadFile.description,
        execute: (input) => executors.uploadFile(files, input),
        name: "uploadFile",
        needsApproval,
        parameters: TOOL_SCHEMAS.uploadFile.input,
    });

export const agentsDeleteFile = (
    files: Files,
    { needsApproval = true }: { needsApproval?: boolean } = {},
): FunctionTool<UnknownContext, DeleteFileParameters, DeleteFileOutput> =>
    tool({
        description: TOOL_SCHEMAS.deleteFile.description,
        execute: (input) => executors.deleteFile(files, input),
        name: "deleteFile",
        needsApproval,
        parameters: TOOL_SCHEMAS.deleteFile.input,
    });

export const agentsCopyFile = (
    files: Files,
    { needsApproval = true }: { needsApproval?: boolean } = {},
): FunctionTool<UnknownContext, CopyFileParameters, CopyFileOutput> =>
    tool({
        description: TOOL_SCHEMAS.copyFile.description,
        execute: (input) => executors.copyFile(files, input),
        name: "copyFile",
        needsApproval,
        parameters: TOOL_SCHEMAS.copyFile.input,
    });

export const agentsSignUploadUrl = (
    files: Files,
    { needsApproval = true }: { needsApproval?: boolean } = {},
): FunctionTool<UnknownContext, SignUploadUrlParameters, SignUploadUrlOutput> =>
    tool({
        description: TOOL_SCHEMAS.signUploadUrl.description,
        execute: (input) => executors.signUploadUrl(files, input),
        name: "signUploadUrl",
        needsApproval,
        parameters: TOOL_SCHEMAS.signUploadUrl.input,
    });

export interface AgentsFileTools {
    copyFile: ReturnType<typeof agentsCopyFile>;
    deleteFile: ReturnType<typeof agentsDeleteFile>;
    downloadFile: ReturnType<typeof agentsDownloadFile>;
    getFileMetadata: ReturnType<typeof agentsGetFileMetadata>;
    getFileUrl: ReturnType<typeof agentsGetFileUrl>;
    listFiles: ReturnType<typeof agentsListFiles>;
    signUploadUrl: ReturnType<typeof agentsSignUploadUrl>;
    uploadFile: ReturnType<typeof agentsUploadFile>;
}

export type ReadOnlyAgentsFileTools = Pick<AgentsFileTools, FileReadToolName>;

export interface AgentsFileToolsOptions {
    files: Files;

    overrides?: Partial<Record<FileToolName, AgentsToolOverrides>>;

    readOnly?: boolean;

    requireApproval?: ApprovalConfig;
}

/**
 * Create a set of storage tools shaped for the OpenAI Agents SDK (`@openai/agents`).
 *
 * Returns a record keyed by tool name — spread `Object.values()` into
 * `new Agent({ tools })`. Write tools require approval by default.
 * @example
 * ```ts
 * import { Agent, run } from "@openai/agents";
 * import { Files } from "@visulima/storage";
 * import { S3Storage } from "@visulima/storage/provider/aws";
 * import { createAgentsFileTools } from "@visulima/storage/ai/openai";
 *
 * const files = new Files({ adapter: new S3Storage({ bucket: "uploads" }) });
 * const tools = createAgentsFileTools({ files });
 *
 * const agent = new Agent({
 *   instructions: "Help the user manage their files.",
 *   name: "Files agent",
 *   tools: Object.values(tools),
 * });
 *
 * const result = await run(agent, "List my files.");
 * ```
 */
export function createAgentsFileTools(options: AgentsFileToolsOptions & { readOnly: true }): ReadOnlyAgentsFileTools;
export function createAgentsFileTools(options: AgentsFileToolsOptions & { readOnly?: false | undefined }): AgentsFileTools;
export function createAgentsFileTools(options: AgentsFileToolsOptions): AgentsFileTools | ReadOnlyAgentsFileTools;
export function createAgentsFileTools({
    files,
    overrides,
    readOnly = false,
    requireApproval = true,
}: AgentsFileToolsOptions): AgentsFileTools | ReadOnlyAgentsFileTools {
    const approval = (name: FileWriteToolName) => {
        return {
            needsApproval: resolveApproval(name, requireApproval),
        };
    };

    const allTools: AgentsFileTools = {
        copyFile: agentsCopyFile(files, approval("copyFile")),
        deleteFile: agentsDeleteFile(files, approval("deleteFile")),
        downloadFile: agentsDownloadFile(files),
        getFileMetadata: agentsGetFileMetadata(files),
        getFileUrl: agentsGetFileUrl(files),
        listFiles: agentsListFiles(files),
        signUploadUrl: agentsSignUploadUrl(files, approval("signUploadUrl")),
        uploadFile: agentsUploadFile(files, approval("uploadFile")),
    };

    if (overrides) {
        for (const [name, toolOverrides] of Object.entries(overrides)) {
            if (name in allTools && toolOverrides) {
                const key = name as keyof AgentsFileTools;

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
    ) as ReadOnlyAgentsFileTools;
}
