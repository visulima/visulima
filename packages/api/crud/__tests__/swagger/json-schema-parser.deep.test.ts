import { describe, expect, it } from "vitest";

import PrismaJsonSchemaParser from "../../src/swagger/json-schema-parser";

describe("prismaJsonSchemaParser deep traversal", () => {
    describe("getExampleModelsSchemas", () => {
        it("should resolve array refs, object properties and nested refs into example values", () => {
            expect.assertions(3);

            const parser = new PrismaJsonSchemaParser({});
            const schemas: Record<string, any> = {
                Owner: {
                    properties: { email: { type: "string" } },
                    type: "object",
                },
                Post: {
                    properties: { title: { type: "string" } },
                    type: "object",
                },
                User: {
                    properties: {
                        id: { type: "integer" },
                        // object-typed property -> objectPropertiesToSchema (with a nested $ref -> referenceToSchema)
                        meta: {
                            properties: {
                                active: { type: "boolean" },
                                owner: { $ref: "#/components/schemas/Owner" },
                            },
                            type: "object",
                        },
                        // array-typed property -> referenceToSchema on items.$ref
                        posts: {
                            items: { $ref: "#/components/schemas/Post" },
                            type: "array",
                        },
                    },
                    type: "object",
                },
            };

            const examples = parser.getExampleModelsSchemas(["User"], schemas);

            const single = (examples.User as { value: Record<string, unknown> }).value;

            expect(single.posts).toStrictEqual([{ title: "string" }]);
            expect(single.meta).toStrictEqual({ active: "boolean", owner: { email: "string" } });

            const page = (examples.UserPage as { value: { data: unknown[]; meta: Record<string, string> } }).value;

            expect(page.data).toStrictEqual([single]);
        });
    });

    describe("parseInputTypes", () => {
        const buildDmmf = (): any => {
            return {
                datamodel: { enums: [], models: [], types: [] },
                mutationType: {
                    fieldMap: {
                        createOneItem: {
                            args: [
                                {
                                    inputTypes: [
                                        {
                                            kind: "object",
                                            type: {
                                                fields: [
                                                    // required scalar that resolves to a single (non-array) type
                                                    {
                                                        inputTypes: [{ isRequired: true, kind: "scalar", type: "Int" }],
                                                        isNullable: false,
                                                        isRequired: true,
                                                        name: "count",
                                                    },
                                                    // object-kind field -> parseObjectInputType branch + recursion
                                                    {
                                                        inputTypes: [
                                                            {
                                                                kind: "object",
                                                                type: {
                                                                    fields: [
                                                                        {
                                                                            inputTypes: [{ isRequired: true, kind: "scalar", type: "Int" }],
                                                                            isNullable: false,
                                                                            isRequired: true,
                                                                            name: "id",
                                                                        },
                                                                    ],
                                                                    name: "OwnerCreateNestedInput",
                                                                },
                                                            },
                                                        ],
                                                        isNullable: true,
                                                        isRequired: false,
                                                        name: "owner",
                                                    },
                                                ],
                                                name: "ItemCreateInput",
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                        updateOneItem: {
                            args: [
                                {
                                    inputTypes: [
                                        {
                                            kind: "object",
                                            type: {
                                                fields: [
                                                    {
                                                        inputTypes: [{ kind: "scalar", type: "Int" }],
                                                        isNullable: false,
                                                        isRequired: false,
                                                        name: "count",
                                                    },
                                                ],
                                                name: "ItemUpdateInput",
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                },
            };
        };

        it("should map a required scalar to a single non-array type and not mark it nullable", () => {
            expect.assertions(2);

            const parser = new PrismaJsonSchemaParser(buildDmmf());
            const result = parser.parseInputTypes(["Item"]);

            const create = result.CreateItem as { properties: Record<string, any>; required?: string[] };

            expect(create.properties.count).toStrictEqual({ type: "integer" });
            expect(create.required).toStrictEqual(["count"]);
        });

        it("should resolve object-kind fields to a nullable $ref and register the nested schema", () => {
            expect.assertions(2);

            const parser = new PrismaJsonSchemaParser(buildDmmf());
            const result = parser.parseInputTypes(["Item"]);

            const create = result.CreateItem as { properties: Record<string, any> };

            expect(create.properties.owner).toStrictEqual({
                $ref: "#/components/schemas/OwnerCreateNestedInput",
                nullable: true,
            });
            // schemaInputTypes are appended to the definitions after the models loop
            expect(result.OwnerCreateNestedInput).toStrictEqual({
                properties: { id: { type: "integer" } },
                type: "object",
                xml: { name: "OwnerCreateNestedInput" },
            });
        });
    });

    describe("parseObjectInputType", () => {
        it("should build an anyOf when a field has multiple non-null input types", () => {
            expect.assertions(1);

            const parser = new PrismaJsonSchemaParser({});
            const fieldType = {
                kind: "object",
                type: {
                    fields: [
                        {
                            inputTypes: [
                                { kind: "scalar", type: "String" },
                                { kind: "scalar", type: "Int" },
                            ],
                            name: "value",
                        },
                    ],
                    name: "ValueInput",
                },
            };

            parser.parseObjectInputType(fieldType);

            const definitions = parser.parseInputTypes([]);

            expect(definitions.ValueInput).toStrictEqual({
                properties: {
                    value: {
                        anyOf: [{ type: "string" }, { type: "integer" }],
                    },
                },
                type: "object",
                xml: { name: "ValueInput" },
            });
        });

        it("should recurse into nested object input types and register them", () => {
            expect.assertions(2);

            const parser = new PrismaJsonSchemaParser({});
            const fieldType = {
                kind: "object",
                type: {
                    fields: [
                        {
                            inputTypes: [
                                {
                                    kind: "object",
                                    type: {
                                        fields: [
                                            {
                                                inputTypes: [{ kind: "scalar", type: "Int" }],
                                                name: "id",
                                            },
                                        ],
                                        name: "InnerInput",
                                    },
                                },
                            ],
                            name: "nested",
                        },
                    ],
                    name: "OuterInput",
                },
            };

            parser.parseObjectInputType(fieldType);

            const definitions = parser.parseInputTypes([]);

            expect(definitions.OuterInput).toStrictEqual({
                properties: { nested: { $ref: "#/components/schemas/InnerInput" } },
                type: "object",
                xml: { name: "OuterInput" },
            });
            expect(definitions.InnerInput).toStrictEqual({
                properties: { id: { type: "integer" } },
                type: "object",
                xml: { name: "InnerInput" },
            });
        });

        it("should collapse a single non-null input type out of a nullable union", () => {
            expect.assertions(1);

            const parser = new PrismaJsonSchemaParser({});
            const fieldType = {
                kind: "object",
                type: {
                    fields: [
                        {
                            inputTypes: [
                                { kind: "scalar", type: "String" },
                                { kind: "scalar", type: "Null" },
                            ],
                            name: "alias",
                        },
                    ],
                    name: "AliasInput",
                },
            };

            parser.parseObjectInputType(fieldType);

            const definitions = parser.parseInputTypes([]);

            expect(definitions.AliasInput).toStrictEqual({
                properties: {
                    alias: {
                        nullable: true,
                        type: "string",
                    },
                },
                type: "object",
                xml: { name: "AliasInput" },
            });
        });
    });
});
