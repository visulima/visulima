import { createPaginationMetaSchemaObject, createPaginationSchemaObject } from "@visulima/pagination";
import type { OpenAPIV3 } from "openapi-types";

import {
    operationIdPrefix,
    sharedErrorSchemaObject,
    sharedFileMetaExampleObject,
    sharedFileMetaSchemaObject,
    sharedGet,
    sharedGetList,
    sharedGetMeta,
} from "./shared";

const swaggerSpec = (
    origin: string,
    path: string,
    options: { supportedTransformerFormat?: string[]; tags?: string[] | undefined; transformer?: boolean | "audio" | "video" | "image" } = {},
): Partial<OpenAPIV3.Document> => {
    const { supportedTransformerFormat, tags, transformer } = { tags: ["Multipart"], transformer: false, ...options };

    const pathHash = operationIdPrefix(path);

    return {
        components: {
            examples: sharedFileMetaExampleObject,
            parameters: {
                UploadIDinPath: {
                    description: "Upload ID",
                    in: "path",
                    name: "id",
                    required: true,
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
                ...createPaginationSchemaObject(
                    "FileMetaPagination",
                    {
                        $ref: "#/components/schemas/FileMeta",
                    },
                    "#/components/schemas/PaginationMeta",
                ),
                ...createPaginationMetaSchemaObject("PaginationMeta"),
                ...sharedErrorSchemaObject,
                ...sharedFileMetaSchemaObject,
            },
        },
        info: { title: "Multipart upload API", version: "1.0.0" },
        openapi: "3.0.3",
        paths: {
            [`${path.replace(/\/$/, "")}/{id}/metadata`]: {
                get: sharedGetMeta(`${pathHash}MultipartGetFileMeta`, tags),
            },
            [`${path.replace(/\/$/, "")}/{id}`]: {
                delete: {
                    description: "Delete an uploaded file",
                    operationId: `${pathHash}MultipartCancel`,
                    parameters: [
                        {
                            $ref: "#/components/parameters/UploadIDinPath",
                        },
                    ],
                    responses: {
                        204: {
                            description: "No Content",
                        },
                        404: {
                            $ref: "#/components/responses/404",
                        },
                    },

                    summary: "Delete file",
                    tags,
                },
                get: sharedGet(`${pathHash}MultipartGetFile`, tags, transformer, supportedTransformerFormat),
            },
            [path.trimEnd()]: {
                get: sharedGetList(`${pathHash}MultipartGetList`, tags),
                post: {
                    description: "Create upload",
                    operationId: `${pathHash}MultipartCreate`,
                    requestBody: {
                        content: {
                            "multipart/form-data": {
                                schema: {
                                    properties: {
                                        file: {
                                            description: "File to upload",
                                            format: "binary",
                                            type: "string",
                                        },
                                        metadata: {
                                            description: "JSON stringifies metadata",
                                            example: '{ "name": "video.mp4", "mimeType": "video/mp4", "size": 741, "lastModified": 1631750105530 }',
                                            type: "string",
                                        },
                                    },
                                    type: "object",
                                },
                            },
                        },
                        description: "Upload Metadata",
                        required: false,
                    },
                    responses: {
                        200: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/FileMeta",
                                    },
                                },
                            },
                            description: "File stored; the body is its metadata",
                            headers: {
                                ETag: {
                                    description: "Upload ETag",
                                    schema: {
                                        example: "d41d8cd98f00b204e9800998ecf8427e",
                                        type: "string",
                                    },
                                },
                                Location: {
                                    description: "URL of the stored file (`<path>/<id>.<extension>`)",
                                    schema: {
                                        example: `${origin}${path.replace(/\/$/, "")}/V1StGXR8_Z5jdHi6B-myT.png`,
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
                                            code: "InvalidFileName",
                                            message: "Invalid file name",
                                            name: "ValidationError",
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
                                            message: "Request entity too large",
                                            name: "ValidationError",
                                        },
                                    },
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Request Entity Too Large",
                        },
                        415: {
                            content: {
                                "application/json": {
                                    example: {
                                        error: {
                                            code: "UnsupportedMediaType",
                                            message: "Unsupported media type",
                                            name: "ValidationError",
                                        },
                                    },
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Unsupported Media Type",
                        },
                        423: {
                            content: {
                                "application/json": {
                                    example: {
                                        error: {
                                            code: "FileLocked",
                                            message: "File locked",
                                        },
                                    },
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "File locked",
                        },
                        500: {
                            content: {
                                "application/json": {
                                    example: {
                                        error: {
                                            code: "GenericUploadError",
                                            message: "Generic Upload Error",
                                        },
                                    },
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Internal Server Error",
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

                    summary: "Create upload",
                    tags,
                },
            },
        },
    };
};

export default swaggerSpec;
