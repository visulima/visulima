import type { Tool } from "ai";
import { tool } from "ai";

import type { Files } from "../../files";
import { executors } from "../internal/executors";
import type {
    CopyFileInput,
    DeleteFileInput,
    DownloadFileInput,
    GetFileMetadataInput,
    GetFileUrlInput,
    ListFilesInput,
    SignUploadUrlInput,
    UploadFileInput,
} from "../internal/schemas";
import { TOOL_SCHEMAS } from "../internal/schemas";
import type { ToolOptions } from "./types";

type ListFilesOutput = Awaited<ReturnType<typeof executors.listFiles>>;
type GetFileMetadataOutput = Awaited<ReturnType<typeof executors.getFileMetadata>>;
type DownloadFileOutput = Awaited<ReturnType<typeof executors.downloadFile>>;
type GetFileUrlOutput = Awaited<ReturnType<typeof executors.getFileUrl>>;
type UploadFileOutput = Awaited<ReturnType<typeof executors.uploadFile>>;
type DeleteFileOutput = Awaited<ReturnType<typeof executors.deleteFile>>;
type CopyFileOutput = Awaited<ReturnType<typeof executors.copyFile>>;
type SignUploadUrlOutput = Awaited<ReturnType<typeof executors.signUploadUrl>>;

export const listFiles = (files: Files): Tool<ListFilesInput, ListFilesOutput> =>
    tool({
        description: TOOL_SCHEMAS.listFiles.description,
        execute: (input) => executors.listFiles(files, input),
        inputSchema: TOOL_SCHEMAS.listFiles.input,
    });

export const getFileMetadata = (files: Files): Tool<GetFileMetadataInput, GetFileMetadataOutput> =>
    tool({
        description: TOOL_SCHEMAS.getFileMetadata.description,
        execute: (input) => executors.getFileMetadata(files, input),
        inputSchema: TOOL_SCHEMAS.getFileMetadata.input,
    });

export const downloadFile = (files: Files): Tool<DownloadFileInput, DownloadFileOutput> =>
    tool({
        description: TOOL_SCHEMAS.downloadFile.description,
        execute: (input) => executors.downloadFile(files, input),
        inputSchema: TOOL_SCHEMAS.downloadFile.input,
    });

export const getFileUrl = (files: Files): Tool<GetFileUrlInput, GetFileUrlOutput> =>
    tool({
        description: TOOL_SCHEMAS.getFileUrl.description,
        execute: (input) => executors.getFileUrl(files, input),
        inputSchema: TOOL_SCHEMAS.getFileUrl.input,
    });

export const uploadFile = (files: Files, { needsApproval = true }: ToolOptions = {}): Tool<UploadFileInput, UploadFileOutput> =>
    tool({
        description: TOOL_SCHEMAS.uploadFile.description,
        execute: (input) => executors.uploadFile(files, input),
        inputSchema: TOOL_SCHEMAS.uploadFile.input,
        needsApproval,
    });

export const deleteFile = (files: Files, { needsApproval = true }: ToolOptions = {}): Tool<DeleteFileInput, DeleteFileOutput> =>
    tool({
        description: TOOL_SCHEMAS.deleteFile.description,
        execute: (input) => executors.deleteFile(files, input),
        inputSchema: TOOL_SCHEMAS.deleteFile.input,
        needsApproval,
    });

export const copyFile = (files: Files, { needsApproval = true }: ToolOptions = {}): Tool<CopyFileInput, CopyFileOutput> =>
    tool({
        description: TOOL_SCHEMAS.copyFile.description,
        execute: (input) => executors.copyFile(files, input),
        inputSchema: TOOL_SCHEMAS.copyFile.input,
        needsApproval,
    });

export const signUploadUrl = (files: Files, { needsApproval = true }: ToolOptions = {}): Tool<SignUploadUrlInput, SignUploadUrlOutput> =>
    tool({
        description: TOOL_SCHEMAS.signUploadUrl.description,
        execute: (input) => executors.signUploadUrl(files, input),
        inputSchema: TOOL_SCHEMAS.signUploadUrl.input,
        needsApproval,
    });
