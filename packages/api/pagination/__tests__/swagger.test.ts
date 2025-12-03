import type { OpenAPIV3 } from "openapi-types";
import { describe, expect, it } from "vitest";

import { createPaginationMetaSchemaObject, createPaginationSchemaObject } from "../src";

describe("swagger", () => {
    it("should return the correct values for the pagination schema object", () => {
        expect.assertions(1);

        const name = "Test";
        const items: OpenAPIV3.SchemaObject = {
            items: {
                type: "string",
            },
            type: "array",
        };

        expect(createPaginationSchemaObject(name, items)).toStrictEqual({
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
                        $ref: "#/components/schemas/PaginationData",
                    },
                },
                type: "object",
                xml: {
                    name,
                },
            },
        });
    });

    it("should return the correct object for the pagination component object", () => {
        expect.assertions(1);

        expect(createPaginationMetaSchemaObject()).toStrictEqual({
            PaginationData: {
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
                    name: "PaginationData",
                },
            },
        });
    });

    it("should return the correct object for the pagination component object with different name", () => {
        expect.assertions(1);

        const name = "Test";

        expect(createPaginationMetaSchemaObject(name)).toStrictEqual({
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
        });
    });
});
