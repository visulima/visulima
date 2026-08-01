/**
 * OpenAPI schema-builder specs executed inside `workerd`. These are pure object
 * builders, so the point of running them on the Workers runtime is to prove the
 * module graph reached from `src/index.ts` pulls in nothing Node-only.
 */
import { describe, expect, it } from "vitest";

import { createPaginationMetaSchemaObject, createPaginationSchemaObject } from "../../src";

describe("workerd pagination meta schema", () => {
    it("emits OpenAPI 3.0 nullable url fields by default", () => {
        expect.assertions(4);

        const schema = createPaginationMetaSchemaObject();

        expect(Object.keys(schema)).toStrictEqual(["PaginationData"]);
        expect(schema.PaginationData?.properties?.nextPageUrl).toStrictEqual({
            description: "The URL for the next page, or null when on the last page",
            nullable: true,
            type: "string",
        });
        expect(schema.PaginationData?.properties?.firstPageUrl).toStrictEqual({
            description: "The URL for the first page",
            type: "string",
        });
        expect(schema.PaginationData?.required).toStrictEqual([
            "firstPage",
            "firstPageUrl",
            "lastPage",
            "lastPageUrl",
            "nextPageUrl",
            "page",
            "perPage",
            "previousPageUrl",
            "total",
        ]);
    });

    it("emits JSON-Schema style nullability for OpenAPI 3.1", () => {
        expect.assertions(2);

        const schema = createPaginationMetaSchemaObject("Meta", { openApiVersion: "3.1" });

        expect(schema.Meta?.properties?.nextPageUrl).toStrictEqual({
            description: "The URL for the next page, or null when on the last page",
            type: ["string", "null"],
        });
        expect(schema.Meta?.properties?.previousPageUrl).toStrictEqual({
            description: "The URL for the previous page, or null when on the first page",
            type: ["string", "null"],
        });
    });

    it("honours a custom component name in the xml block", () => {
        expect.assertions(2);

        const schema = createPaginationMetaSchemaObject("CustomMeta");

        expect(Object.keys(schema)).toStrictEqual(["CustomMeta"]);
        expect(schema.CustomMeta?.xml).toStrictEqual({ name: "CustomMeta" });
    });
});

describe("workerd pagination response schema", () => {
    it("wraps an item schema in a paginated envelope", () => {
        expect.assertions(1);

        expect(createPaginationSchemaObject("Users", { $ref: "#/components/schemas/User" })).toStrictEqual({
            Users: {
                properties: {
                    data: {
                        items: { $ref: "#/components/schemas/User" },
                        type: "array",
                        xml: { name: "data", wrapped: true },
                    },
                    meta: { $ref: "#/components/schemas/PaginationData" },
                },
                required: ["data", "meta"],
                type: "object",
                xml: { name: "Users" },
            },
        });
    });

    it("accepts the meta reference as a bare string", () => {
        expect.assertions(1);

        const schema = createPaginationSchemaObject("Users", { type: "string" }, "#/components/schemas/Meta");

        expect(schema.Users?.properties?.meta).toStrictEqual({ $ref: "#/components/schemas/Meta" });
    });

    it("accepts the meta reference through the options object", () => {
        expect.assertions(1);

        const schema = createPaginationSchemaObject("Users", { type: "string" }, { metaReference: "#/components/schemas/Meta" });

        expect(schema.Users?.properties?.meta).toStrictEqual({ $ref: "#/components/schemas/Meta" });
    });
});
