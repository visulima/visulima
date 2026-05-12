import type { ServerTool } from "@tanstack/ai";
import { toolDefinition } from "@tanstack/ai";

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

type ListFilesParameters = typeof TOOL_SCHEMAS.listFiles.input;
type GetFileMetadataParameters = typeof TOOL_SCHEMAS.getFileMetadata.input;
type DownloadFileParameters = typeof TOOL_SCHEMAS.downloadFile.input;
type GetFileUrlParameters = typeof TOOL_SCHEMAS.getFileUrl.input;
type UploadFileParameters = typeof TOOL_SCHEMAS.uploadFile.input;
type DeleteFileParameters = typeof TOOL_SCHEMAS.deleteFile.input;
type CopyFileParameters = typeof TOOL_SCHEMAS.copyFile.input;
type SignUploadUrlParameters = typeof TOOL_SCHEMAS.signUploadUrl.input;

export const listFiles = (files: Files): ServerTool<ListFilesParameters, never, "listFiles"> =>
    toolDefinition({
        description: TOOL_SCHEMAS.listFiles.description,
        inputSchema: TOOL_SCHEMAS.listFiles.input,
        name: "listFiles",
    }).server((input) => executors.listFiles(files, input as ListFilesInput)) as ServerTool<ListFilesParameters, never, "listFiles">;

export const getFileMetadata = (files: Files): ServerTool<GetFileMetadataParameters, never, "getFileMetadata"> =>
    toolDefinition({
        description: TOOL_SCHEMAS.getFileMetadata.description,
        inputSchema: TOOL_SCHEMAS.getFileMetadata.input,
        name: "getFileMetadata",
    }).server((input) => executors.getFileMetadata(files, input as GetFileMetadataInput)) as ServerTool<GetFileMetadataParameters, never, "getFileMetadata">;

export const downloadFile = (files: Files): ServerTool<DownloadFileParameters, never, "downloadFile"> =>
    toolDefinition({
        description: TOOL_SCHEMAS.downloadFile.description,
        inputSchema: TOOL_SCHEMAS.downloadFile.input,
        name: "downloadFile",
    }).server((input) => executors.downloadFile(files, input as DownloadFileInput)) as ServerTool<DownloadFileParameters, never, "downloadFile">;

export const getFileUrl = (files: Files): ServerTool<GetFileUrlParameters, never, "getFileUrl"> =>
    toolDefinition({
        description: TOOL_SCHEMAS.getFileUrl.description,
        inputSchema: TOOL_SCHEMAS.getFileUrl.input,
        name: "getFileUrl",
    }).server((input) => executors.getFileUrl(files, input as GetFileUrlInput)) as ServerTool<GetFileUrlParameters, never, "getFileUrl">;

export const uploadFile = (files: Files, { needsApproval = true }: ToolOptions = {}): ServerTool<UploadFileParameters, never, "uploadFile"> =>
    toolDefinition({
        description: TOOL_SCHEMAS.uploadFile.description,
        inputSchema: TOOL_SCHEMAS.uploadFile.input,
        name: "uploadFile",
        needsApproval,
    }).server((input) => executors.uploadFile(files, input as UploadFileInput)) as ServerTool<UploadFileParameters, never, "uploadFile">;

export const deleteFile = (files: Files, { needsApproval = true }: ToolOptions = {}): ServerTool<DeleteFileParameters, never, "deleteFile"> =>
    toolDefinition({
        description: TOOL_SCHEMAS.deleteFile.description,
        inputSchema: TOOL_SCHEMAS.deleteFile.input,
        name: "deleteFile",
        needsApproval,
    }).server((input) => executors.deleteFile(files, input as DeleteFileInput)) as ServerTool<DeleteFileParameters, never, "deleteFile">;

export const copyFile = (files: Files, { needsApproval = true }: ToolOptions = {}): ServerTool<CopyFileParameters, never, "copyFile"> =>
    toolDefinition({
        description: TOOL_SCHEMAS.copyFile.description,
        inputSchema: TOOL_SCHEMAS.copyFile.input,
        name: "copyFile",
        needsApproval,
    }).server((input) => executors.copyFile(files, input as CopyFileInput)) as ServerTool<CopyFileParameters, never, "copyFile">;

export const signUploadUrl = (files: Files, { needsApproval = true }: ToolOptions = {}): ServerTool<SignUploadUrlParameters, never, "signUploadUrl"> =>
    toolDefinition({
        description: TOOL_SCHEMAS.signUploadUrl.description,
        inputSchema: TOOL_SCHEMAS.signUploadUrl.input,
        name: "signUploadUrl",
        needsApproval,
    }).server((input) => executors.signUploadUrl(files, input as SignUploadUrlInput)) as ServerTool<SignUploadUrlParameters, never, "signUploadUrl">;
