import type { OpenAPIV3 } from "openapi-types";

export const createPaginationMetaSchemaObject = (name = "PaginationData"): Record<string, OpenAPIV3.SchemaObject> => {
    return {
        [name]: {
            properties: {
                firstPage: {
                    description: "Returns the number for the first page. It is always 1",
                    minimum: 0,
                    type: "integer",
                },
                firstPageUrl: {
                    description: "The URL for the first page",
                    type: "string",
                },
                lastPage: {
                    description: "Returns the value for the last page by taking the total of rows into account",
                    minimum: 0,
                    type: "integer",
                },
                lastPageUrl: {
                    description: "The URL for the last page",
                    type: "string",
                },
                nextPageUrl: {
                    description: "The URL for the next page",
                    type: "string",
                },
                page: {
                    description: "Current page number",
                    minimum: 1,
                    type: "integer",
                },
                perPage: {
                    description: "Returns the value for the limit passed to the paginate method",
                    minimum: 0,
                    type: "integer",
                },
                previousPageUrl: {
                    description: "The URL for the previous page",
                    type: "string",
                },
                total: {
                    description: "Holds the value for the total number of rows in the database",
                    minimum: 0,
                    type: "integer",
                },
            },
            type: "object",
            xml: {
                name,
            },
        },
    };
};

export const createPaginationSchemaObject = (
    name: string,
    items: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject,
    metaReference = "#/components/schemas/PaginationData",
): Record<string, OpenAPIV3.SchemaObject> => {
    return {
        [name]: {
            properties: {
                data: {
                    items,
                    type: "array",
                    xml: {
                        name: "data",
                        wrapped: true,
                    },
                },
                meta: {
                    $ref: metaReference,
                },
            },
            type: "object",
            xml: {
                name,
            },
        },
    };
};
