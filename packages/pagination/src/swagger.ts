import type { OpenAPIV3 } from "openapi-types";

export const createPaginationMetaSchemaObject = (name: string = "PaginationData"): { [key: string]: OpenAPIV3.SchemaObject } => ({
    [name]: {
        type: "object",
        xml: {
            name,
        },
        properties: {
            total: {
                type: "integer",
                minimum: 0,
                description: "Holds the value for the total number of rows in the database",
            },
            perPage: {
                type: "integer",
                minimum: 0,
                description: "Returns the value for the limit passed to the paginate method",
            },
            page: {
                type: "integer",
                minimum: 1,
                description: "Current page number",
            },
            lastPage: {
                type: "integer",
                minimum: 0,
                description: "Returns the value for the last page by taking the total of rows into account",
            },
            firstPage: {
                type: "integer",
                minimum: 0,
                description: "Returns the number for the first page. It is always 1",
            },
            firstPageUrl: {
                type: "string",
                description: "The URL for the first page",
            },
            lastPageUrl: {
                type: "string",
                description: "The URL for the last page",
            },
            nextPageUrl: {
                type: "string",
                description: "The URL for the next page",
            },
            previousPageUrl: {
                type: "string",
                description: "The URL for the previous page",
            },
        },
    },
});

export const createPaginationSchemaObject = (
    name: string,
    items: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject,
    metaReference: string = "#/components/schemas/PaginationData",
): { [key: string]: OpenAPIV3.SchemaObject } => {
    return {
        [name]: {
            type: "object",
            xml: {
                name,
            },
            properties: {
                data: {
                    type: "array",
                    xml: {
                        name: "data",
                        wrapped: true,
                    },
                    items,
                },
                meta: {
                    $ref: metaReference,
                },
            },
        },
    };
};
