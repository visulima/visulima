import { createPaginationMetaSchemaObject, createPaginationSchemaObject } from "@visulima/pagination";
import type { OpenAPIV3 } from "openapi-types";

import {
    sharedErrorSchemaObject,
    sharedFileMetaExampleObject,
    sharedFileMetaSchemaObject,
    sharedGet,
    sharedGetList,
} from "./shared-swagger";
import { createHash } from "node:crypto";

const swaggerSpec = (origin: string, path: string = "/", tags: string[] | undefined = ["Multipart"]): Partial<OpenAPIV3.Document> => {
    const pathHash = createHash('sha256').update(path).digest('base64');

    return {
        paths: {
            [path.trimEnd()]: {
                post: {
                    // eslint-disable-next-line radar/no-duplicate-string
                    summary: "Create upload",
                    description: "Create upload",
                    operationId: `${pathHash}MultipartCreate`,
                    tags,
                    requestBody: {
                        description: "Upload Metadata",
                        required: false,
                        content: {
                            "multipart/form-data": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        metadata: {
                                            type: "string",
                                            description: "JSON stringifies metadata",
                                            example: '{ "name": "video.mp4", "mimeType": "video/mp4", "size": 741, "lastModified": 1631750105530 }',
                                        },
                                        file: {
                                            type: "string",
                                            format: "binary",
                                            description: "File to upload",
                                        },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        200: {
                            description: "The file already exists, send a resume request",
                            headers: {
                                Location: {
                                    schema: {
                                        type: "string",
                                        format: "uri",
                                        // eslint-disable-next-line no-secrets/no-secrets
                                        example: `${origin}/files?uploadType=Upload&upload_id=2b62dbec20048158af963572fbdf89c6`,
                                    },
                                    // eslint-disable-next-line radar/no-duplicate-string
                                    description: "Resumable URI",
                                },
                                "X-Upload-Expires": {
                                    schema: {
                                        type: "string",
                                        // eslint-disable-next-line radar/no-duplicate-string
                                        example: "2021-08-25T11:12:26.635Z",
                                        format: "date-time",
                                    },
                                    // eslint-disable-next-line radar/no-duplicate-string
                                    description: "Upload expiration date",
                                },
                            },
                        },
                        201: {
                            description: "Upload accepted, send the file contents",
                            headers: {
                                Location: {
                                    schema: {
                                        type: "string",
                                        format: "uri",
                                        // eslint-disable-next-line no-secrets/no-secrets
                                        example: `${origin}/files?uploadType=Upload&upload_id=2b62dbec20048158af963572fbdf89c6`,
                                    },
                                    description: "Resumable URI",
                                },
                                "X-Upload-Expires": {
                                    schema: {
                                        type: "string",
                                        example: "2021-08-25T11:12:26.635Z",
                                        format: "date-time",
                                    },
                                    description: "Upload expiration date",
                                },
                            },
                        },
                        400: {
                            description: "Bad Request",
                            content: {
                                // eslint-disable-next-line radar/no-duplicate-string
                                "application/json": {
                                    schema: {
                                        // eslint-disable-next-line radar/no-duplicate-string
                                        $ref: "#/components/schemas/Error",
                                    },
                                    example: {
                                        error: {
                                            name: "ValidationError",
                                            code: "InvalidFileName",
                                            message: "Invalid file name",
                                        },
                                    },
                                },
                            },
                        },
                        413: {
                            description: "Request Entity Too Large",
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                    example: {
                                        error: {
                                            name: "ValidationError",
                                            code: "RequestEntityTooLarge",
                                            message: "Request entity too large",
                                        },
                                    },
                                },
                            },
                        },
                        415: {
                            description: "Unsupported Media Type",
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                    example: {
                                        error: {
                                            name: "ValidationError",
                                            code: "UnsupportedMediaType",
                                            message: "Unsupported media type",
                                        },
                                    },
                                },
                            },
                        },
                        423: {
                            description: "File locked",
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                    example: {
                                        error: {
                                            code: "FileLocked",
                                            message: "File locked",
                                        },
                                    },
                                },
                            },
                        },
                        500: {
                            description: "Internal Server Error",
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                    example: {
                                        error: {
                                            code: "GenericUploadError",
                                            message: "Generic Upload Error",
                                        },
                                    },
                                },
                            },
                        },
                        default: {
                            description: "Error",
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                        },
                    },
                },
                get: sharedGetList(`${pathHash}MultipartGetList`, tags),
            },
            [`${path.trimEnd()}/{id}`]: {
                delete: {
                    // eslint-disable-next-line radar/no-duplicate-string
                    summary: "Cancel upload",
                    description: "Cancel upload",
                    operationId: `${pathHash}MultipartCancel`,
                    tags,
                    parameters: [
                        {
                            // eslint-disable-next-line radar/no-duplicate-string
                            $ref: "#/components/parameters/UploadIDinPath",
                        },
                    ],
                    responses: {
                        204: {
                            // eslint-disable-next-line radar/no-duplicate-string
                            description: "No Content",
                        },
                    },
                },
                get: sharedGet(`${pathHash}TusGetFile`, tags),
            },
        },
        components: {
            parameters: {
                UploadIDinPath: {
                    name: "id",
                    in: "path",
                    description: "Upload ID",
                    schema: {
                        type: "string",
                    },
                },
            },
            schemas: {
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
            responses: {
                404: {
                    description: "Not Found",
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/Error",
                            },
                            example: {
                                error: {
                                    code: "FileNotFound",
                                    message: "Not found",
                                },
                            },
                        },
                    },
                },
            },
            examples: sharedFileMetaExampleObject,
        },
    };
};

export default swaggerSpec;
