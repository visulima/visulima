import type { FileObject, Files } from "../../files";
import type {
    CopyFileInput,
    DeleteFileInput,
    DownloadFileInput,
    GetFileMetadataInput,
    GetFileUrlInput,
    ListFilesInput,
    SearchFilesInput,
    SignUploadUrlInput,
    UploadFileInput,
} from "./schemas";
import { DEFAULT_MAX_DOWNLOAD_BYTES, MAX_DOWNLOAD_BYTES } from "./schemas";

/** Matches a `searchFiles` call returns when the input sets no `limit`. */
const DEFAULT_SEARCH_LIMIT = 100;

const serializeLastModified = (value: Date | number | string | undefined): string | undefined => {
    if (value === undefined) {
        return undefined;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    return typeof value === "number" ? new Date(value).toISOString() : value;
};

/**
 * Read at most about `maxBytes` of an object without buffering the rest: a ranged read when the
 * adapter supports it, otherwise a stream abandoned once the cap is reached.
 */
const readCapped = async (files: Files, key: string, maxBytes: number): Promise<Buffer> => {
    if (files.capabilities.range) {
        const { body } = await files.download(key, { range: { end: maxBytes - 1, start: 0 } });

        return body;
    }

    const { body } = await files.downloadStream(key);
    const chunks: Buffer[] = [];
    let total = 0;

    // Leaving the loop early destroys the stream, so the remainder is never read.
    for await (const chunk of body) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);

        chunks.push(buffer);
        total += buffer.byteLength;

        if (total >= maxBytes) {
            break;
        }
    }

    return Buffer.concat(chunks);
};

const toListItem = (item: FileObject): ListFilesItem => {
    return {
        contentType: item.contentType,
        ...(item.etag ? { etag: item.etag } : {}),
        key: item.key,
        ...(serializeLastModified(item.lastModified) ? { lastModified: serializeLastModified(item.lastModified) } : {}),
        ...(typeof item.size === "number" ? { size: item.size } : {}),
    };
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
    searchFiles: (files: Files, input: SearchFilesInput) => Promise<ListFilesResult>;
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

        // Unknown size: never pull the whole object just to measure it. Read at most limit + 1 bytes
        // (a ranged read, or a streamed read cut off at the cap) — one byte over proves it's too big.
        const body = typeof head.size === "number" ? await files.download(key).then((result) => result.body) : await readCapped(files, key, limit + 1);

        if (body.byteLength > limit) {
            throw new RangeError(`downloadFile refused: "${key}" returned more than ${limit} bytes, which exceeds the maxBytes limit. Use getFileUrl instead.`);
        }

        const size = head.size ?? body.byteLength;

        return {
            content: body.toString(binary ? "base64" : "utf8"),
            contentType: head.contentType,
            encoding: binary ? "base64" : "text",
            key: head.key,
            size,
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

        return { items: results.map((item) => toListItem(item)) };
    },

    searchFiles: async (files: Files, { caseInsensitive, limit, match, pattern, prefix }: SearchFilesInput): Promise<ListFilesResult> => {
        const items: ListFilesItem[] = [];

        for await (const item of files.search(pattern, { caseInsensitive, limit: limit ?? DEFAULT_SEARCH_LIMIT, match, prefix })) {
            items.push(toListItem(item));
        }

        return { items };
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
