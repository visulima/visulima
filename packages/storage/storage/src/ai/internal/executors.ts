import type { Files } from "../../files";
import type {
    CopyFileInput,
    DeleteFileInput,
    DownloadFileInput,
    GetFileMetadataInput,
    GetFileUrlInput,
    ListFilesInput,
    SignUploadUrlInput,
    UploadFileInput,
} from "./schemas";
import { DEFAULT_MAX_DOWNLOAD_BYTES, MAX_DOWNLOAD_BYTES } from "./schemas";

const serializeLastModified = (value: Date | number | string | undefined): string | undefined => {
    if (value === undefined) {
        return undefined;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    return typeof value === "number" ? new Date(value).toISOString() : value;
};

export interface CopyFileResult {
    copied: true;
    etag: string | undefined;
    from: string;
    key: string;
    to: string;
}

export interface DeleteFileResult {
    deleted: true;
    key: string;
}

export interface DownloadFileResult {
    content: string;
    contentType: string | undefined;
    encoding: "base64" | "text";
    key: string;
    size?: number;
}

export interface FileMetadataResult {
    contentType: string | undefined;
    etag?: string;
    key: string;
    lastModified?: string;
    metadata?: Record<string, unknown>;
    size?: number;
}

export interface FileUrlResult {
    key: string;
    url: string;
}

export interface ListFilesItem {
    contentType: string | undefined;
    etag?: string;
    key: string;
    lastModified?: string;
    size?: number;
}

export interface ListFilesResult {
    items: ListFilesItem[];
}

export interface SignUploadUrlResult {
    key: string;
    url: string;
}

export interface UploadFileResult {
    contentType: string | undefined;
    etag?: string;
    key: string;
    lastModified?: string;
    size?: number;
}

export interface Executors {
    copyFile: (files: Files, input: CopyFileInput) => Promise<CopyFileResult>;
    deleteFile: (files: Files, input: DeleteFileInput) => Promise<DeleteFileResult>;
    downloadFile: (files: Files, input: DownloadFileInput) => Promise<DownloadFileResult>;
    getFileMetadata: (files: Files, input: GetFileMetadataInput) => Promise<FileMetadataResult>;
    getFileUrl: (files: Files, input: GetFileUrlInput) => Promise<FileUrlResult>;
    listFiles: (files: Files, input: ListFilesInput) => Promise<ListFilesResult>;
    signUploadUrl: (files: Files, input: SignUploadUrlInput) => Promise<SignUploadUrlResult>;
    uploadFile: (files: Files, input: UploadFileInput) => Promise<UploadFileResult>;
}

export const executors: Executors = {
    copyFile: async (files: Files, { from, to }: CopyFileInput): Promise<CopyFileResult> => {
        const result = await files.copy(from, to);

        return {
            copied: true,
            etag: result.etag,
            from,
            key: result.key,
            to,
        };
    },

    deleteFile: async (files: Files, { key }: DeleteFileInput): Promise<DeleteFileResult> => {
        await files.delete(key);

        return { deleted: true, key };
    },

    downloadFile: async (files: Files, { binary, key, maxBytes }: DownloadFileInput): Promise<DownloadFileResult> => {
        const limit = maxBytes ?? DEFAULT_MAX_DOWNLOAD_BYTES;

        if (limit > MAX_DOWNLOAD_BYTES) {
            throw new RangeError(
                `downloadFile refused: maxBytes (${limit}) exceeds the maximum of ${MAX_DOWNLOAD_BYTES}. Use getFileUrl to delegate larger downloads to the client.`,
            );
        }

        const head = await files.head(key);

        if (typeof head.size === "number" && head.size > limit) {
            throw new RangeError(
                `downloadFile refused: "${key}" is ${head.size} bytes which exceeds the maxBytes limit of ${limit}. Use getFileUrl to delegate to the client, or raise maxBytes.`,
            );
        }

        const result = await files.download(key);

        if (result.body.byteLength > limit) {
            throw new RangeError(
                `downloadFile refused: "${key}" returned ${result.body.byteLength} bytes which exceeds the maxBytes limit of ${limit}. Use getFileUrl instead.`,
            );
        }

        if (binary) {
            return {
                content: result.body.toString("base64"),
                contentType: result.contentType,
                encoding: "base64",
                key: result.key,
                ...(typeof result.size === "number" ? { size: result.size } : {}),
            };
        }

        return {
            content: result.body.toString("utf8"),
            contentType: result.contentType,
            encoding: "text",
            key: result.key,
            ...(typeof result.size === "number" ? { size: result.size } : {}),
        };
    },

    getFileMetadata: async (files: Files, { key }: GetFileMetadataInput): Promise<FileMetadataResult> => {
        const head = await files.head(key);

        return {
            contentType: head.contentType,
            ...(head.etag ? { etag: head.etag } : {}),
            key: head.key,
            ...(serializeLastModified(head.lastModified) ? { lastModified: serializeLastModified(head.lastModified) } : {}),
            ...(head.metadata ? { metadata: head.metadata } : {}),
            ...(typeof head.size === "number" ? { size: head.size } : {}),
        };
    },

    getFileUrl: async (files: Files, { expiresIn, key, responseContentDisposition }: GetFileUrlInput): Promise<FileUrlResult> => {
        const url = await files.url(key, { expiresIn, responseContentDisposition });

        return { key, url };
    },

    listFiles: async (files: Files, { limit, prefix }: ListFilesInput): Promise<ListFilesResult> => {
        const results = await files.list({ limit, prefix });

        return {
            items: results.map((item): ListFilesItem => {
                return {
                    contentType: item.contentType,
                    ...(item.etag ? { etag: item.etag } : {}),
                    key: item.key,
                    ...(serializeLastModified(item.lastModified) ? { lastModified: serializeLastModified(item.lastModified) } : {}),
                    ...(typeof item.size === "number" ? { size: item.size } : {}),
                };
            }),
        };
    },

    signUploadUrl: async (files: Files, { contentType, expiresIn, key }: SignUploadUrlInput): Promise<SignUploadUrlResult> => {
        const url = await files.signedUploadUrl(key, { contentType, expiresIn });

        return { key, url };
    },

    uploadFile: async (files: Files, { content, contentType, encoding, key, metadata }: UploadFileInput): Promise<UploadFileResult> => {
        const body = encoding === "base64" ? Buffer.from(content, "base64") : Buffer.from(content, "utf8");
        const result = await files.upload(key, body, { contentType, metadata });

        return {
            contentType: result.contentType,
            ...(result.etag ? { etag: result.etag } : {}),
            key: result.key,
            ...(serializeLastModified(result.lastModified) ? { lastModified: serializeLastModified(result.lastModified) } : {}),
            ...(typeof result.size === "number" ? { size: result.size } : {}),
        };
    },
};
