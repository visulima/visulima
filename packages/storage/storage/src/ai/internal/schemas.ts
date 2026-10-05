import * as z from "zod";

/**
 * Default upper bound on `downloadFile` payload size. The tool boundary is
 * JSON, so anything larger than ~1 MiB is almost certainly a mistake (it
 * blows up the model context and the response payload). Callers can raise
 * the cap per-invocation via `maxBytes`, up to {@link MAX_DOWNLOAD_BYTES}.
 */
export const DEFAULT_MAX_DOWNLOAD_BYTES: number = 1024 * 1024;

/**
 * Absolute ceiling on `downloadFile` payload size. A `maxBytes` override above
 * this is rejected so an oversized download cannot be pulled inline into the
 * model context / JSON tool response. Use `getFileUrl` to delegate larger
 * downloads to the client.
 */
export const MAX_DOWNLOAD_BYTES: number = 10 * 1024 * 1024;

export const listFilesInputSchema: z.ZodObject<{
    limit: z.ZodOptional<z.ZodNumber>;
    prefix: z.ZodOptional<z.ZodString>;
}> = z.object({
    limit: z.int().positive().max(1000).optional().meta({ description: "Maximum number of items to return" }),
    prefix: z.string().trim().optional().meta({ description: "Only return keys that start with this prefix" }),
});

export const searchFilesInputSchema: z.ZodObject<{
    caseInsensitive: z.ZodOptional<z.ZodBoolean>;
    limit: z.ZodOptional<z.ZodNumber>;
    match: z.ZodOptional<z.ZodEnum<{ exact: "exact"; glob: "glob"; substring: "substring" }>>;
    pattern: z.ZodString;
    prefix: z.ZodOptional<z.ZodString>;
}> = z.object({
    caseInsensitive: z.boolean().optional().meta({ description: "Match case-insensitively" }),
    limit: z.int().positive().max(1000).optional().meta({ description: "Maximum number of matches to return (default 100)" }),
    // No regex: the pattern comes from a model that may be prompt-injected, and a backtracking
    // expression would block the event loop. Callers that need regex use Files.search directly.
    match: z
        .enum(["glob", "substring", "exact"])
        .optional()
        .meta({ description: 'How to read pattern: "glob" (default; * within a path segment, ** across segments), "substring" or "exact"' }),
    pattern: z.string().trim().min(1).max(256).meta({ description: "Pattern the whole object key must match, e.g. reports/**/*.csv" }),
    prefix: z.string().trim().optional().meta({ description: "Only search keys under this prefix (recommended for substring searches)" }),
});

export const getFileMetadataInputSchema: z.ZodObject<{
    key: z.ZodString;
}> = z.object({
    key: z.string().trim().meta({ description: "The object key to inspect" }),
});

export const downloadFileInputSchema: z.ZodObject<{
    binary: z.ZodOptional<z.ZodBoolean>;
    key: z.ZodString;
    maxBytes: z.ZodOptional<z.ZodNumber>;
}> = z.object({
    binary: z.boolean().optional().meta({ description: "When true, returns base64-encoded bytes instead of UTF-8 text" }),
    key: z.string().trim().meta({ description: "The object key to download" }),
    maxBytes: z
        .int()
        .positive()
        .max(MAX_DOWNLOAD_BYTES)
        .optional()
        .meta({
            description: `Reject downloads larger than this byte count (default ${DEFAULT_MAX_DOWNLOAD_BYTES}, maximum ${MAX_DOWNLOAD_BYTES}). Verified via head() before transferring.`,
        }),
});

export const getFileUrlInputSchema: z.ZodObject<{
    expiresIn: z.ZodOptional<z.ZodNumber>;
    key: z.ZodString;
    responseContentDisposition: z.ZodOptional<z.ZodString>;
}> = z.object({
    expiresIn: z.int().positive().optional().meta({ description: "Override the adapter default URL expiry in seconds. Ignored by permanent-CDN adapters." }),
    key: z.string().trim().meta({ description: "The object key to build a URL for" }),
    responseContentDisposition: z.string().trim().optional().meta({
        description:
            "Force a Content-Disposition header on the response (e.g. 'attachment; filename=\"f.txt\"'). Strongly recommended for user-uploaded content to prevent inline rendering of HTML/SVG.",
    }),
});

export const uploadFileInputSchema: z.ZodObject<{
    content: z.ZodString;
    contentType: z.ZodOptional<z.ZodString>;
    encoding: z.ZodOptional<z.ZodEnum<{ base64: "base64"; text: "text" }>>;
    key: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}> = z.object({
    // `content` may legitimately carry leading/trailing whitespace (text bodies)
    // or trailing newlines (base64 payloads), so we don't trim it.
    // eslint-disable-next-line zod/prefer-string-schema-with-trim
    content: z.string().meta({ description: 'File body. Treated as UTF-8 text unless encoding is "base64".' }),
    contentType: z.string().trim().optional().meta({ description: "MIME type recorded with the object" }),
    encoding: z.enum(["text", "base64"]).optional().meta({ description: "How to interpret content (default: text)" }),
    key: z.string().trim().meta({ description: "Destination object key" }),
    // Metadata values can be empty strings or whitespace-only when the caller
    // intentionally encodes that meaning, so we don't trim them.
    // eslint-disable-next-line zod/prefer-string-schema-with-trim
    metadata: z.record(z.string().trim(), z.string()).optional().meta({ description: "Custom string metadata to attach to the object" }),
});

export const deleteFileInputSchema: z.ZodObject<{
    key: z.ZodString;
}> = z.object({
    key: z.string().trim().meta({ description: "Object key to delete" }),
});

export const copyFileInputSchema: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
}> = z.object({
    from: z.string().trim().meta({ description: "Source object key" }),
    to: z.string().trim().meta({ description: "Destination object key" }),
});

export const signUploadUrlInputSchema: z.ZodObject<{
    contentType: z.ZodOptional<z.ZodString>;
    expiresIn: z.ZodNumber;
    key: z.ZodString;
}> = z.object({
    contentType: z.string().trim().optional().meta({ description: "Content-Type that the upload must declare" }),
    expiresIn: z.int().positive().meta({ description: "Lifetime of the presigned URL in seconds" }),
    key: z.string().trim().meta({ description: "Destination object key" }),
});

export interface ToolSchema<TInput extends z.ZodObject<z.ZodRawShape>> {
    description: string;
    input: TInput;
}

export interface ToolSchemaMap {
    copyFile: ToolSchema<typeof copyFileInputSchema>;
    deleteFile: ToolSchema<typeof deleteFileInputSchema>;
    downloadFile: ToolSchema<typeof downloadFileInputSchema>;
    getFileMetadata: ToolSchema<typeof getFileMetadataInputSchema>;
    getFileUrl: ToolSchema<typeof getFileUrlInputSchema>;
    listFiles: ToolSchema<typeof listFilesInputSchema>;
    searchFiles: ToolSchema<typeof searchFilesInputSchema>;
    signUploadUrl: ToolSchema<typeof signUploadUrlInputSchema>;
    uploadFile: ToolSchema<typeof uploadFileInputSchema>;
}

export const TOOL_SCHEMAS: ToolSchemaMap = {
    copyFile: {
        description: "Copy a file to a new key within the configured bucket. The source remains intact.",
        input: copyFileInputSchema,
    },
    deleteFile: {
        description: "Permanently delete a file from the configured bucket.",
        input: deleteFileInputSchema,
    },
    downloadFile: {
        description:
            "Download a file and return its contents. Returns UTF-8 text by default; set binary=true to receive base64-encoded bytes. Files larger than maxBytes are rejected before transfer.",
        input: downloadFileInputSchema,
    },
    getFileMetadata: {
        description: "Fetch metadata for a single file (size, content type, etag, custom metadata) without transferring its body.",
        input: getFileMetadataInputSchema,
    },
    getFileUrl: {
        description:
            "Return a signed, time-limited URL the caller can use to fetch a file. Adapters that don't support presigning will throw MethodNotAllowed.",
        input: getFileUrlInputSchema,
    },
    listFiles: {
        description: "List files in the configured bucket, optionally filtered by key prefix.",
        input: listFilesInputSchema,
    },
    searchFiles: {
        description:
            "Find files whose key matches a glob (default), regular expression, substring or exact pattern, walking the whole bucket. Returns at most limit matches.",
        input: searchFilesInputSchema,
    },
    signUploadUrl: {
        description:
            "Issue a presigned URL that lets a client upload directly to the configured bucket. Approval-gated by default — the URL grants upload permission until it expires.",
        input: signUploadUrlInputSchema,
    },
    uploadFile: {
        description: 'Upload a file to the configured bucket. Pass content as UTF-8 text by default, or as base64 with encoding="base64" for binary payloads.',
        input: uploadFileInputSchema,
    },
};

export type FileToolName = keyof ToolSchemaMap;

export type FileReadToolName = "downloadFile" | "getFileMetadata" | "getFileUrl" | "listFiles" | "searchFiles";

export type FileWriteToolName = "copyFile" | "deleteFile" | "signUploadUrl" | "uploadFile";

export const WRITE_TOOL_NAMES: ReadonlyArray<FileWriteToolName> = ["uploadFile", "deleteFile", "copyFile", "signUploadUrl"];

export const WRITE_TOOL_NAME_SET: ReadonlySet<FileWriteToolName> = new Set(WRITE_TOOL_NAMES);

export type ListFilesInput = z.infer<typeof listFilesInputSchema>;
export type SearchFilesInput = z.infer<typeof searchFilesInputSchema>;
export type GetFileMetadataInput = z.infer<typeof getFileMetadataInputSchema>;
export type DownloadFileInput = z.infer<typeof downloadFileInputSchema>;
export type GetFileUrlInput = z.infer<typeof getFileUrlInputSchema>;
export type UploadFileInput = z.infer<typeof uploadFileInputSchema>;
export type DeleteFileInput = z.infer<typeof deleteFileInputSchema>;
export type CopyFileInput = z.infer<typeof copyFileInputSchema>;
export type SignUploadUrlInput = z.infer<typeof signUploadUrlInputSchema>;
