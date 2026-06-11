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
                required: ["data", "meta"],
                type: "object",
                xml: {
                    name,
                },
            },
        });
    });

    it("should allow overriding the meta reference via options", () => {
        expect.assertions(1);

        const items: OpenAPIV3.SchemaObject = { items: { type: "string" }, type: "array" };

        expect(createPaginationSchemaObject("Test", items, { metaReference: "#/components/schemas/CustomMeta" }).Test).toMatchObject({
            properties: {
                meta: { $ref: "#/components/schemas/CustomMeta" },
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
                        description: "The URL for the next page, or null when on the last page",
                        nullable: true,
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
                        description: "The URL for the previous page, or null when on the first page",
                        nullable: true,
                        type: "string",
                    },
                    total: {
                        description: "Holds the value for the total number of rows in the database",
                        minimum: 0,
                        type: "integer",
                    },
                },
                required: ["firstPage", "firstPageUrl", "lastPage", "lastPageUrl", "nextPageUrl", "page", "perPage", "previousPageUrl", "total"],
                type: "object",
                xml: {
                    name: "PaginationData",
                },
            },
        });
    });

    it("should emit OpenAPI 3.1 nullable url fields when requested", () => {
        expect.assertions(2);

        const schema = createPaginationMetaSchemaObject("PaginationData", { openApiVersion: "3.1" }).PaginationData;

        expect((schema.properties as Record<string, unknown>).nextPageUrl).toStrictEqual({
            description: "The URL for the next page, or null when on the last page",
            type: ["string", "null"],
        });
        expect((schema.properties as Record<string, unknown>).previousPageUrl).toStrictEqual({
            description: "The URL for the previous page, or null when on the first page",
            type: ["string", "null"],
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
                        description: "The URL for the next page, or null when on the last page",
                        nullable: true,
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
                        description: "The URL for the previous page, or null when on the first page",
                        nullable: true,
                        type: "string",
                    },
                    total: {
                        description: "Holds the value for the total number of rows in the database",
                        minimum: 0,
                        type: "integer",
                    },
                },
                required: ["firstPage", "firstPageUrl", "lastPage", "lastPageUrl", "nextPageUrl", "page", "perPage", "previousPageUrl", "total"],
                type: "object",
                xml: {
                    name,
                },
            },
        });
    });
});
