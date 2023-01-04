import type { OpenAPIV3 } from "openapi-types";

const FileMetaExample: OpenAPIV3.ExampleObject = {
    value: {
        id: "391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3",
        createdAt: "2022-12-16T10:35:17.466Z",
        modifiedAt: "2022-12-16T10:35:17.470Z",
    },
};

export const sharedGetList = (operationId: string, tags: string[] | undefined): OpenAPIV3.OperationObject => {
    return {
        // eslint-disable-next-line radar/no-duplicate-string
        summary: "List upload",
        description: "List upload",
        operationId,
        tags,
        parameters: [
            {
                name: "limit",
                in: "query",
                schema: {
                    type: "integer",
                    nullable: true,
                },
                description: "Maximum number of elements to retrieve.",
            },
            {
                name: "page",
                in: "query",
                schema: {
                    type: "integer",
                    nullable: true,
                },
                description: "Page number. Use only for pagination.",
            },
        ],
        responses: {
            200: {
                description: "OK",
                content: {
                    // eslint-disable-next-line radar/no-duplicate-string
                    "application/json": {
                        schema: {
                            // eslint-disable-next-line radar/no-duplicate-string
                            $ref: "#/components/schemas/FileMeta",
                        },
                        examples: {
                            Default: {
                                $ref: "#/components/examples/FileMeta",
                            },
                            Pagination: {
                                $ref: "#/components/examples/FileMetaPagination",
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
                            // eslint-disable-next-line radar/no-duplicate-string
                            $ref: "#/components/schemas/Error",
                        },
                    },
                },
            },
        },
    };
};

export const sharedGet = (operationId: string, tags: string[] | undefined): OpenAPIV3.OperationObject => {
    return {
        tags,
        summary: "Get the uploaded file",
        description: "Get the uploaded file",
        operationId,
        parameters: [
            {
                name: "id",
                in: "path",
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
                    "Last-Modified": {
                        schema: {
                            type: "string",
                            // eslint-disable-next-line radar/no-duplicate-string
                            example: "2021-08-25T11:12:26.635Z",
                            format: "date-time",
                        },
                        // eslint-disable-next-line radar/no-duplicate-string
                        description: "Upload last modified date",
                    },
                    ETag: {
                        schema: {
                            type: "string",
                            // eslint-disable-next-line radar/no-duplicate-string
                            example: "d41d8cd98f00b204e9800998ecf8427e",
                        },
                        // eslint-disable-next-line radar/no-duplicate-string
                        description: "Upload ETag",
                    },
                },
            },
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
    };
};

export const sharedErrorSchemaObject: { [key: string]: OpenAPIV3.NonArraySchemaObject } = {
    Error: {
        description: "Error",
        type: "object",
        properties: {
            error: {
                type: "object",
                required: ["message"],
                properties: {
                    name: {
                        type: "string",
                        minLength: 3,
                    },
                    code: {
                        type: "string",
                        minLength: 1,
                    },
                    message: {
                        type: "string",
                        minLength: 1,
                    },
                },
            },
        },
        required: ["error"],
    },
};

export const sharedFileMetaSchemaObject: { [key: string]: OpenAPIV3.NonArraySchemaObject } = {
    FileMeta: {
        description: "File meta",
        type: "object",
        properties: {
            id: {
                type: "string",
                minLength: 1,
            },
            name: {
                type: "string",
                minLength: 1,
            },
            metadata: {
                type: "object",
            },
            originalName: {
                type: "string",
                minLength: 1,
            },
            contentType: {
                type: "string",
            },
            bytesWritten: {
                type: "integer",
            },
            status: {
                type: "string",
                enum: ["completed", "part", "deleted", "created"],
            },
            createdAt: {
                type: "string",
                format: "date-time",
            },
        },
    },
};

export const sharedFileMetaExampleObject: { [key: string]: OpenAPIV3.ExampleObject } = {
    FileMeta: {
        value: [FileMetaExample],
    },
    FileMetaPagination: {
        value: {
            data: [FileMetaExample.value],
            meta: {
                total: 1,
                perPage: 1,
                page: 1,
                lastPage: 1,
                firstPage: 1,
                firstPageUrl: "/?page=1",
                lastPageUrl: "/?page=10",
                nextPageUrl: "/?page=2",
                previousPageUrl: null,
            },
        },
    },
};
