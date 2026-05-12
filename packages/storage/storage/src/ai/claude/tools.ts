import type { SdkMcpToolDefinition } from "@anthropic-ai/claude-agent-sdk";
import { tool } from "@anthropic-ai/claude-agent-sdk";

import type { Files } from "../../files";
import { executors } from "../internal/executors";
import { TOOL_SCHEMAS } from "../internal/schemas";
import type { ToolAnnotations } from "./types";

const READ_ANNOTATIONS: ToolAnnotations = { readOnlyHint: true };

const WRITE_ANNOTATIONS: ToolAnnotations = {
    destructiveHint: true,
    readOnlyHint: false,
};

const IDEMPOTENT_WRITE_ANNOTATIONS: ToolAnnotations = {
    destructiveHint: false,
    idempotentHint: true,
    readOnlyHint: false,
};

const okResult = (output: unknown): { content: Array<{ text: string; type: "text" }> } => {
    return {
        content: [
            {
                text: typeof output === "string" ? output : JSON.stringify(output),
                type: "text" as const,
            },
        ],
    };
};

const errorResult = (error: unknown): { content: Array<{ text: string; type: "text" }>; isError: true } => {
    return {
        content: [
            {
                text: error instanceof Error ? error.message : String(error),
                type: "text" as const,
            },
        ],
        isError: true as const,
    };
};

const wrap =
    <T>(run: (input: T) => Promise<unknown>) =>
    async (input: T): Promise<ReturnType<typeof okResult> | ReturnType<typeof errorResult>> => {
        try {
            return okResult(await run(input));
        } catch (error) {
            return errorResult(error);
        }
    };

export interface ClaudeWriteToolOptions {
    annotations?: ToolAnnotations;
}

type ListFilesShape = (typeof TOOL_SCHEMAS.listFiles.input)["shape"];
type GetFileMetadataShape = (typeof TOOL_SCHEMAS.getFileMetadata.input)["shape"];
type DownloadFileShape = (typeof TOOL_SCHEMAS.downloadFile.input)["shape"];
type GetFileUrlShape = (typeof TOOL_SCHEMAS.getFileUrl.input)["shape"];
type UploadFileShape = (typeof TOOL_SCHEMAS.uploadFile.input)["shape"];
type DeleteFileShape = (typeof TOOL_SCHEMAS.deleteFile.input)["shape"];
type CopyFileShape = (typeof TOOL_SCHEMAS.copyFile.input)["shape"];
type SignUploadUrlShape = (typeof TOOL_SCHEMAS.signUploadUrl.input)["shape"];

export const claudeListFiles = (files: Files): SdkMcpToolDefinition<ListFilesShape> =>
    tool(
        "listFiles",
        TOOL_SCHEMAS.listFiles.description,
        TOOL_SCHEMAS.listFiles.input.shape,
        wrap((input) => executors.listFiles(files, input)),
        { annotations: READ_ANNOTATIONS },
    );

export const claudeGetFileMetadata = (files: Files): SdkMcpToolDefinition<GetFileMetadataShape> =>
    tool(
        "getFileMetadata",
        TOOL_SCHEMAS.getFileMetadata.description,
        TOOL_SCHEMAS.getFileMetadata.input.shape,
        wrap((input) => executors.getFileMetadata(files, input)),
        { annotations: READ_ANNOTATIONS },
    );

export const claudeDownloadFile = (files: Files): SdkMcpToolDefinition<DownloadFileShape> =>
    tool(
        "downloadFile",
        TOOL_SCHEMAS.downloadFile.description,
        TOOL_SCHEMAS.downloadFile.input.shape,
        wrap((input) => executors.downloadFile(files, input)),
        { annotations: READ_ANNOTATIONS },
    );

export const claudeGetFileUrl = (files: Files): SdkMcpToolDefinition<GetFileUrlShape> =>
    tool(
        "getFileUrl",
        TOOL_SCHEMAS.getFileUrl.description,
        TOOL_SCHEMAS.getFileUrl.input.shape,
        wrap((input) => executors.getFileUrl(files, input)),
        { annotations: READ_ANNOTATIONS },
    );

export const claudeUploadFile = (
    files: Files,
    { annotations = WRITE_ANNOTATIONS }: ClaudeWriteToolOptions = {},
): SdkMcpToolDefinition<UploadFileShape> =>
    tool(
        "uploadFile",
        TOOL_SCHEMAS.uploadFile.description,
        TOOL_SCHEMAS.uploadFile.input.shape,
        wrap((input) => executors.uploadFile(files, input)),
        { annotations },
    );

export const claudeDeleteFile = (
    files: Files,
    { annotations = WRITE_ANNOTATIONS }: ClaudeWriteToolOptions = {},
): SdkMcpToolDefinition<DeleteFileShape> =>
    tool(
        "deleteFile",
        TOOL_SCHEMAS.deleteFile.description,
        TOOL_SCHEMAS.deleteFile.input.shape,
        wrap((input) => executors.deleteFile(files, input)),
        { annotations },
    );

export const claudeCopyFile = (
    files: Files,
    { annotations = IDEMPOTENT_WRITE_ANNOTATIONS }: ClaudeWriteToolOptions = {},
): SdkMcpToolDefinition<CopyFileShape> =>
    tool(
        "copyFile",
        TOOL_SCHEMAS.copyFile.description,
        TOOL_SCHEMAS.copyFile.input.shape,
        wrap((input) => executors.copyFile(files, input)),
        { annotations },
    );

export const claudeSignUploadUrl = (
    files: Files,
    { annotations = IDEMPOTENT_WRITE_ANNOTATIONS }: ClaudeWriteToolOptions = {},
): SdkMcpToolDefinition<SignUploadUrlShape> =>
    tool(
        "signUploadUrl",
        TOOL_SCHEMAS.signUploadUrl.description,
        TOOL_SCHEMAS.signUploadUrl.input.shape,
        wrap((input) => executors.signUploadUrl(files, input)),
        { annotations },
    );
