import type { OpenAPIV3 } from "openapi-types";

const FileMetaExample: OpenAPIV3.ExampleObject = {
    value: {
        createdAt: "2022-12-16T10:35:17.466Z",
        id: "391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3",
        modifiedAt: "2022-12-16T10:35:17.470Z",
    },
};

export const sharedGetList = (operationId: string, tags: string[] | undefined): OpenAPIV3.OperationObject => {
    return {
        description: "List upload",
        operationId,
        parameters: [
            {
                description: "Maximum number of elements to retrieve.",
                in: "query",
                name: "limit",
                schema: {
                    nullable: true,
                    type: "integer",
                },
            },
            {
                description: "Page number. Use only for pagination.",
                in: "query",
                name: "page",
                schema: {
                    nullable: true,
                    type: "integer",
                },
            },
        ],
        responses: {
            200: {
                content: {
                    "application/json": {
                        examples: {
                            Default: {
                                $ref: "#/components/examples/FileMeta",
                            },
                            Pagination: {
                                $ref: "#/components/examples/FileMetaPagination",
                            },
                        },
                        schema: {
                            $ref: "#/components/schemas/FileMeta",
                        },
                    },
                },
                description: "OK",
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

        summary: "List upload",
        tags,
    };
};

export const sharedGet = (operationId: string, tags: string[] | undefined): OpenAPIV3.OperationObject => {
    return {
        description: "Get the uploaded file",
        operationId,
        parameters: [
            {
                in: "path",
                name: "id",
                required: true,
                schema: {
                    type: "string",
                },
            },
        ],
        responses: {
            200: {
                description: "OK",
                headers: {
                    ETag: {
                        description: "Upload ETag",
                        schema: {
                            example: "d41d8cd98f00b204e9800998ecf8427e",
                            type: "string",
                        },
                    },
                    "Last-Modified": {
                        description: "Upload last modified date",
                        schema: {
                            example: "2021-08-25T11:12:26.635Z",
                            format: "date-time",
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
        summary: "Get the uploaded file",
        tags,
    };
};

export const sharedErrorSchemaObject: Record<string, OpenAPIV3.NonArraySchemaObject> = {
    Error: {
        description: "Error",
        properties: {
            error: {
                properties: {
                    code: {
                        minLength: 1,
                        type: "string",
                    },
                    message: {
                        minLength: 1,
                        type: "string",
                    },
                    name: {
                        minLength: 3,
                        type: "string",
                    },
                },
                required: ["message"],
                type: "object",
            },
        },
        required: ["error"],
        type: "object",
    },
};

export const sharedFileMetaSchemaObject: Record<string, OpenAPIV3.NonArraySchemaObject> = {
    FileMeta: {
        description: "File meta",
        properties: {
            bytesWritten: {
                type: "integer",
            },
            contentType: {
                type: "string",
            },
            createdAt: {
                format: "date-time",
                type: "string",
            },
            id: {
                minLength: 1,
                type: "string",
            },
            metadata: {
                type: "object",
            },
            name: {
                minLength: 1,
                type: "string",
            },
            originalName: {
                minLength: 1,
                type: "string",
            },
            status: {
                enum: ["completed", "part", "deleted", "created"],
                type: "string",
            },
        },
        type: "object",
    },
};

export const sharedFileMetaExampleObject: Record<string, OpenAPIV3.ExampleObject> = {
    FileMeta: {
        value: [FileMetaExample],
    },
    FileMetaPagination: {
        value: {
            data: [FileMetaExample.value],
            meta: {
                firstPage: 1,
                firstPageUrl: "/?page=1",
                lastPage: 1,
                lastPageUrl: "/?page=10",
                nextPageUrl: "/?page=2",
                page: 1,
                perPage: 1,
                previousPageUrl: null,
                total: 1,
            },
        },
    },
};
