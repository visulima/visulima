import type { OpenAPIV3 } from "openapi-types";
import { describe, expect, it } from "vitest";

import { createPaginationMetaSchemaObject, createPaginationSchemaObject } from "../src";

describe("Swagger", () => {
    it("should return the correct values for the pagination schema object", () => {
        const name = "Test";
        const items: OpenAPIV3.SchemaObject = {
            type: "array",
            items: {
                type: "string",
            },
        };

        expect(createPaginationSchemaObject(name, items)).toEqual({
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
                        $ref: "#/components/schemas/PaginationData",
                    },
                },
            },
        });
    });

    it("should return the correct object for the pagination component object", () => {
        expect(createPaginationMetaSchemaObject()).toEqual({
            PaginationData: {
                type: "object",
                xml: {
                    name: "PaginationData",
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
    });

    it("should return the correct object for the pagination component object with different name", () => {
        const name = "Test";

        expect(createPaginationMetaSchemaObject(name)).toEqual({
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
    });
});
