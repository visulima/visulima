import { createHash } from "node:crypto";

import { createPaginationMetaSchemaObject, createPaginationSchemaObject } from "@visulima/pagination";
import type { OpenAPIV3 } from "openapi-types";

import { sharedErrorSchemaObject, sharedFileMetaExampleObject, sharedFileMetaSchemaObject, sharedGet, sharedGetList, sharedGetMeta } from "./shared";

const swaggerSpec = (
    origin: string,
    path: string,
    options: { supportedTransformerFormat?: string[]; tags?: string[] | undefined; transformer?: boolean | "audio" | "video" | "image" },
): Partial<OpenAPIV3.Document> => {
    const { supportedTransformerFormat, tags, transformer } = { tags: ["REST"], transformer: false, ...options };

    const pathHash = createHash("sha256").update(path).digest("base64");

    return {
        components: {
            examples: sharedFileMetaExampleObject,
            parameters: {
                UploadIDinPath: {
                    description: "Upload ID",
                    in: "path",
                    name: "id",
                    schema: {
                        type: "string",
                    },
                },
            },
            responses: {
                404: {
                    content: {
                        "application/json": {
                            example: {
                                error: {
                                    code: "FileNotFound",
                                    message: "Not found",
                                },
                            },
                            schema: {
                                $ref: "#/components/schemas/Error",
                            },
                        },
                    },
                    description: "Not Found",
                },
            },
            schemas: {
                "X-Chunk-Checksum": {
                    description: "SHA256 checksum of the chunk data for validation. Format: 'sha256 <base64-encoded-checksum>'.",
                    type: "string",
                },
                "X-Chunk-Offset": {
                    description: "Byte offset for the chunk being uploaded. Required for PATCH requests in chunked uploads.",
                    type: "integer",
                },
                "X-Chunked-Upload": {
                    description: "Header to indicate chunked upload initialization. Set to 'true' to initialize a chunked upload session.",
                    enum: ["true"],
                    type: "string",
                },
                "X-Chunked-Upload-Response": {
                    description: "Indicates this is a chunked upload session. Returned in HEAD responses.",
                    enum: ["true"],
                    type: "string",
                },
                "X-Received-Chunks": {
                    description: "JSON array of received chunk offsets. Used for resumable uploads.",
                    type: "string",
                },
                "X-Total-Size": {
                    description: "Total size of the file in bytes for chunked uploads. Required when X-Chunked-Upload is 'true'.",
                    type: "integer",
                },
                "X-Upload-Complete": {
                    description: "Indicates if the upload is complete. Set to 'true' when all chunks have been uploaded.",
                    enum: ["true", "false"],
                    type: "string",
                },
                "X-Upload-Offset": {
                    description: "Current upload offset in bytes. Returned in responses for chunked uploads.",
                    type: "integer",
                },
                ...createPaginationSchemaObject(
                    "FileMetaPagination",
                    {
                        $ref: "#/components/schemas/PaginationMeta",
                    },
                    "#/components/schemas/PaginationMeta",
                ),
                ...createPaginationMetaSchemaObject("PaginationMeta"),
                ...sharedErrorSchemaObject,
                ...sharedFileMetaSchemaObject,
            },
        },
        paths: {
            [`${path.replace(/\/$/, "")}/{id}/metadata`]: {
                get: sharedGetMeta(`${pathHash}RestGetFileMeta`, tags),
            },
            [`${path.replace(/\/$/, "")}/{id}`]: {
                delete: {
                    description: "Delete a single file",
                    operationId: `${pathHash}RestDeleteFile`,
                    parameters: [
                        {
                            $ref: "#/components/parameters/UploadIDinPath",
                        },
                    ],
                    responses: {
                        204: {
                            description: "No Content - File deleted successfully",
                        },
                        404: {
                            $ref: "#/components/responses/404",
                        },
                        default: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Error",
                        },
                    },
                    summary: "Delete file",
                    tags,
                },
                get: sharedGet(`${pathHash}RestGetFile`, tags, transformer, supportedTransformerFormat),
                head: {
                    description:
                        "Get file metadata and upload progress. For chunked uploads, returns progress information including current offset and completion status.",
                    operationId: `${pathHash}RestHeadFile`,
                    parameters: [
                        {
                            $ref: "#/components/parameters/UploadIDinPath",
                        },
                    ],
                    responses: {
                        200: {
                            description: "OK",
                            headers: {
                                "Content-Length": {
                                    description: "File size in bytes",
                                    schema: {
                                        type: "integer",
                                    },
                                },
                                "Content-Type": {
                                    description: "MIME type of the file",
                                    schema: {
                                        type: "string",
                                    },
                                },
                                ETag: {
                                    description: "Entity tag for caching",
                                    schema: {
                                        example: "d41d8cd98f00b204e9800998ecf8427e",
                                        type: "string",
                                    },
                                },
                                "Last-Modified": {
                                    description: "Last modified date",
                                    schema: {
                                        example: "2021-08-25T11:12:26.635Z",
                                        format: "date-time",
                                        type: "string",
                                    },
                                },
                                "X-Chunked-Upload": {
                                    description: "Indicates this is a chunked upload session",
                                    schema: {
                                        $ref: "#/components/schemas/X-Chunked-Upload-Response",
                                    },
                                },
                                "X-Received-Chunks": {
                                    description: "JSON array of received chunk offsets (chunked uploads only)",
                                    schema: {
                                        $ref: "#/components/schemas/X-Received-Chunks",
                                    },
                                },
                                "X-Upload-Complete": {
                                    description: "Indicates if upload is complete (chunked uploads only)",
                                    schema: {
                                        $ref: "#/components/schemas/X-Upload-Complete",
                                    },
                                },
                                "X-Upload-Expires": {
                                    description: "Upload expiration date",
                                    schema: {
                                        example: "2021-08-25T11:12:26.635Z",
                                        format: "date-time",
                                        type: "string",
                                    },
                                },
                                "X-Upload-Offset": {
                                    description: "Current upload offset in bytes (chunked uploads only)",
                                    schema: {
                                        $ref: "#/components/schemas/X-Upload-Offset",
                                    },
                                },
                            },
                        },
                        404: {
                            $ref: "#/components/responses/404",
                        },
                        default: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Error",
                        },
                    },
                    summary: "Get file metadata",
                    tags,
                },
                patch: {
                    description: "Upload a chunk for chunked uploads. Requires X-Chunk-Offset header and chunk data in the request body.",
                    operationId: `${pathHash}RestPatchChunk`,
                    parameters: [
                        {
                            $ref: "#/components/parameters/UploadIDinPath",
                        },
                        {
                            description: "Byte offset for this chunk",
                            in: "header",
                            name: "X-Chunk-Offset",
                            required: true,
                            schema: {
                                $ref: "#/components/schemas/X-Chunk-Offset",
                            },
                        },
                        {
                            description: "SHA256 checksum of the chunk (optional)",
                            in: "header",
                            name: "X-Chunk-Checksum",
                            required: false,
                            schema: {
                                $ref: "#/components/schemas/X-Chunk-Checksum",
                            },
                        },
                    ],
                    requestBody: {
                        content: {
                            "application/octet-stream": {
                                description: "Chunk data as raw binary",
                                schema: {
                                    format: "binary",
                                    type: "string",
                                },
                            },
                        },
                        description: "Chunk data",
                        required: true,
                    },
                    responses: {
                        200: {
                            description: "Chunk uploaded successfully",
                            headers: {
                                ETag: {
                                    description: "Upload ETag",
                                    schema: {
                                        example: "d41d8cd98f00b204e9800998ecf8427e",
                                        type: "string",
                                    },
                                },
                                Location: {
                                    description: "File URL",
                                    schema: {
                                        example: `${origin}${path}/file-id`,
                                        format: "uri",
                                        type: "string",
                                    },
                                },
                                "X-Upload-Complete": {
                                    description: "Indicates if upload is complete",
                                    schema: {
                                        $ref: "#/components/schemas/X-Upload-Complete",
                                    },
                                },
                                "X-Upload-Expires": {
                                    description: "Upload expiration date",
                                    schema: {
                                        example: "2021-08-25T11:12:26.635Z",
                                        format: "date-time",
                                        type: "string",
                                    },
                                },
                                "X-Upload-Offset": {
                                    description: "Current upload offset after this chunk",
                                    schema: {
                                        $ref: "#/components/schemas/X-Upload-Offset",
                                    },
                                },
                            },
                        },
                        201: {
                            description: "Upload completed (all chunks received)",
                            headers: {
                                ETag: {
                                    description: "Upload ETag",
                                    schema: {
                                        example: "d41d8cd98f00b204e9800998ecf8427e",
                                        type: "string",
                                    },
                                },
                                Location: {
                                    description: "File URL",
                                    schema: {
                                        example: `${origin}${path}/file-id`,
                                        format: "uri",
                                        type: "string",
                                    },
                                },
                                "X-Upload-Complete": {
                                    description: "Upload is complete",
                                    schema: {
                                        enum: ["true"],
                                        type: "string",
                                    },
                                },
                                "X-Upload-Expires": {
                                    description: "Upload expiration date",
                                    schema: {
                                        example: "2021-08-25T11:12:26.635Z",
                                        format: "date-time",
                                        type: "string",
                                    },
                                },
                            },
                        },
                        400: {
                            content: {
                                "application/json": {
                                    example: {
                                        error: {
                                            code: "BadRequest",
                                            message: "X-Chunk-Offset header is required",
                                        },
                                    },
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Bad Request",
                        },
                        404: {
                            content: {
                                "application/json": {
                                    example: {
                                        error: {
                                            code: "FileNotFound",
                                            message: "Upload session not found",
                                        },
                                    },
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Not Found",
                        },
                        413: {
                            content: {
                                "application/json": {
                                    example: {
                                        error: {
                                            code: "RequestEntityTooLarge",
                                            message: "Chunk size exceeds maximum allowed size of 104857600 bytes",
                                        },
                                    },
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Request Entity Too Large",
                        },
                        default: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Error",
                        },
                    },
                    summary: "Upload chunk",
                    tags,
                },
                put: {
                    description: "Create or update a file. Requires file ID in the URL path. If file exists, it will be overwritten.",
                    operationId: `${pathHash}RestPutFile`,
                    parameters: [
                        {
                            $ref: "#/components/parameters/UploadIDinPath",
                        },
                    ],
                    requestBody: {
                        content: {
                            "application/octet-stream": {
                                description: "File data as raw binary",
                                schema: {
                                    format: "binary",
                                    type: "string",
                                },
                            },
                        },
                        description: "File data",
                        required: true,
                    },
                    responses: {
                        200: {
                            description: "File updated successfully",
                            headers: {
                                ETag: {
                                    description: "Upload ETag",
                                    schema: {
                                        example: "d41d8cd98f00b204e9800998ecf8427e",
                                        type: "string",
                                    },
                                },
                                Location: {
                                    description: "File URL",
                                    schema: {
                                        example: `${origin}${path}/file-id`,
                                        format: "uri",
                                        type: "string",
                                    },
                                },
                                "X-Upload-Expires": {
                                    description: "Upload expiration date",
                                    schema: {
                                        example: "2021-08-25T11:12:26.635Z",
                                        format: "date-time",
                                        type: "string",
                                    },
                                },
                            },
                        },
                        201: {
                            description: "File created successfully",
                            headers: {
                                ETag: {
                                    description: "Upload ETag",
                                    schema: {
                                        example: "d41d8cd98f00b204e9800998ecf8427e",
                                        type: "string",
                                    },
                                },
                                Location: {
                                    description: "File URL",
                                    schema: {
                                        example: `${origin}${path}/file-id`,
                                        format: "uri",
                                        type: "string",
                                    },
                                },
                                "X-Upload-Expires": {
                                    description: "Upload expiration date",
                                    schema: {
                                        example: "2021-08-25T11:12:26.635Z",
                                        format: "date-time",
                                        type: "string",
                                    },
                                },
                            },
                        },
                        400: {
                            content: {
                                "application/json": {
                                    example: {
                                        error: {
                                            code: "BadRequest",
                                            message: "Request body is required",
                                        },
                                    },
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Bad Request",
                        },
                        413: {
                            content: {
                                "application/json": {
                                    example: {
                                        error: {
                                            code: "RequestEntityTooLarge",
                                            message: "File size exceeds maximum allowed size",
                                        },
                                    },
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Request Entity Too Large",
                        },
                        default: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Error",
                        },
                    },
                    summary: "Create or update file",
                    tags,
                },
            },
            [path.trimEnd()]: {
                delete: {
                    description:
                        "Delete multiple files. Supports batch delete via query parameter (?ids=id1,id2,id3) or JSON body ({ids: [\"id1\", \"id2\"]} or [\"id1\", \"id2\"]).",
                    operationId: `${pathHash}RestBatchDelete`,
                    parameters: [
                        {
                            description: "Comma-separated list of file IDs to delete",
                            in: "query",
                            name: "ids",
                            required: false,
                            schema: {
                                example: "id1,id2,id3",
                                type: "string",
                            },
                        },
                    ],
                    requestBody: {
                        content: {
                            "application/json": {
                                schema: {
                                    oneOf: [
                                        {
                                            properties: {
                                                ids: {
                                                    description: "Array of file IDs to delete",
                                                    items: {
                                                        type: "string",
                                                    },
                                                    type: "array",
                                                },
                                            },
                                            required: ["ids"],
                                            type: "object",
                                        },
                                        {
                                            description: "Array of file IDs to delete",
                                            items: {
                                                type: "string",
                                            },
                                            type: "array",
                                        },
                                    ],
                                },
                            },
                        },
                        description: "File IDs to delete (optional if using query parameter)",
                        required: false,
                    },
                    responses: {
                        204: {
                            description: "All files deleted successfully",
                        },
                        207: {
                            description: "Multi-Status - Some files deleted successfully",
                            headers: {
                                "X-Delete-Errors": {
                                    description: "JSON array of deletion errors",
                                    schema: {
                                        type: "string",
                                    },
                                },
                                "X-Delete-Failed": {
                                    description: "Number of files that failed to delete",
                                    schema: {
                                        type: "integer",
                                    },
                                },
                                "X-Delete-Successful": {
                                    description: "Number of files successfully deleted",
                                    schema: {
                                        type: "integer",
                                    },
                                },
                            },
                        },
                        400: {
                            content: {
                                "application/json": {
                                    example: {
                                        error: {
                                            code: "BadRequest",
                                            message: "No file IDs provided",
                                        },
                                    },
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Bad Request",
                        },
                        404: {
                            content: {
                                "application/json": {
                                    example: {
                                        error: {
                                            code: "FileNotFound",
                                            message: "Failed to delete files: id1, id2",
                                        },
                                    },
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Not Found",
                        },
                        default: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Error",
                        },
                    },
                    summary: "Batch delete files",
                    tags,
                },
                get: sharedGetList(`${pathHash}RestGetList`, tags),
                post: {
                    description:
                        "Upload a file with raw binary data or initialize a chunked upload session. For chunked uploads, set X-Chunked-Upload: true and X-Total-Size headers.",
                    operationId: `${pathHash}RestPostFile`,
                    parameters: [
                        {
                            description: "Set to 'true' to initialize a chunked upload session",
                            in: "header",
                            name: "X-Chunked-Upload",
                            required: false,
                            schema: {
                                $ref: "#/components/schemas/X-Chunked-Upload",
                            },
                        },
                        {
                            description: "Total size of the file in bytes (required for chunked uploads)",
                            in: "header",
                            name: "X-Total-Size",
                            required: false,
                            schema: {
                                $ref: "#/components/schemas/X-Total-Size",
                            },
                        },
                        {
                            description: "Optional filename",
                            in: "header",
                            name: "Content-Disposition",
                            required: false,
                            schema: {
                                example: "attachment; filename=\"photo.jpg\"",
                                type: "string",
                            },
                        },
                        {
                            description: "Optional JSON metadata",
                            in: "header",
                            name: "X-File-Metadata",
                            required: false,
                            schema: {
                                example: "{\"description\":\"My photo\"}",
                                type: "string",
                            },
                        },
                    ],
                    requestBody: {
                        content: {
                            "application/octet-stream": {
                                description: "File data as raw binary. For chunked upload initialization, body can be empty.",
                                schema: {
                                    format: "binary",
                                    type: "string",
                                },
                            },
                        },
                        description: "File data (optional for chunked upload initialization)",
                        required: false,
                    },
                    responses: {
                        200: {
                            description: "The file already exists, send a resume request",
                            headers: {
                                ETag: {
                                    description: "Upload ETag",
                                    schema: {
                                        example: "d41d8cd98f00b204e9800998ecf8427e",
                                        type: "string",
                                    },
                                },
                                Location: {
                                    description: "File URL",
                                    schema: {
                                        example: `${origin}${path}/file-id`,
                                        format: "uri",
                                        type: "string",
                                    },
                                },
                                "X-Upload-Expires": {
                                    description: "Upload expiration date",
                                    schema: {
                                        example: "2021-08-25T11:12:26.635Z",
                                        format: "date-time",
                                        type: "string",
                                    },
                                },
                            },
                        },
                        201: {
                            description: "File uploaded successfully or chunked upload session initialized",
                            headers: {
                                ETag: {
                                    description: "Upload ETag",
                                    schema: {
                                        example: "d41d8cd98f00b204e9800998ecf8427e",
                                        type: "string",
                                    },
                                },
                                Location: {
                                    description: "File URL or chunked upload session URL",
                                    schema: {
                                        example: `${origin}${path}/file-id`,
                                        format: "uri",
                                        type: "string",
                                    },
                                },
                                "X-Upload-Expires": {
                                    description: "Upload expiration date",
                                    schema: {
                                        example: "2021-08-25T11:12:26.635Z",
                                        format: "date-time",
                                        type: "string",
                                    },
                                },
                            },
                        },
                        400: {
                            content: {
                                "application/json": {
                                    example: {
                                        error: {
                                            code: "BadRequest",
                                            message: "Request body is required for non-chunked uploads",
                                        },
                                    },
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Bad Request",
                        },
                        413: {
                            content: {
                                "application/json": {
                                    example: {
                                        error: {
                                            code: "RequestEntityTooLarge",
                                            message: "File size exceeds maximum allowed size",
                                        },
                                    },
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Request Entity Too Large",
                        },
                        default: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Error",
                        },
                    },
                    summary: "Upload file or initialize chunked upload",
                    tags,
                },
            },
        },
    };
};

export default swaggerSpec;

