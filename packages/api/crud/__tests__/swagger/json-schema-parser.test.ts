import { describe, expect, it } from "vitest";

import PrismaJsonSchemaParser from "../../src/swagger/json-schema-parser";

describe(PrismaJsonSchemaParser, () => {
    describe("getPaginationDataSchema", () => {
        it("should return a PaginationData schema object", () => {
            expect.assertions(2);

            const parser = new PrismaJsonSchemaParser({});
            const schema = parser.getPaginationDataSchema();

            expect(schema).toHaveProperty("PaginationData");
            expect((schema.PaginationData as { type: string }).type).toBe("object");
        });
    });

    describe("getPaginatedModelsSchemas", () => {
        it("should produce <Model>Page schemas with data array + meta ref", () => {
            expect.assertions(3);

            const parser = new PrismaJsonSchemaParser({});
            const schemas = parser.getPaginatedModelsSchemas(["User"]);

            expect(schemas).toHaveProperty("UserPage");

            const userPage = schemas.UserPage as {
                properties: { data: { items: { $ref: string }; type: string }; meta: { $ref: string } };
            };

            expect(userPage.properties.data.items.$ref).toBe("#/components/schemas/User");
            expect(userPage.properties.meta.$ref).toBe("#/components/schemas/PaginationData");
        });
    });

    describe("formatInputTypeData", () => {
        it("should return $ref for object kind", () => {
            expect.assertions(1);

            const parser = new PrismaJsonSchemaParser({});
            const result = parser.formatInputTypeData({
                kind: "object",
                type: { name: "UserCreateInput" },
            });

            expect(result).toStrictEqual({ $ref: "#/components/schemas/UserCreateInput" });
        });

        it("should return wrapped array when isList for object kind", () => {
            expect.assertions(1);

            const parser = new PrismaJsonSchemaParser({});
            const result = parser.formatInputTypeData({
                isList: true,
                kind: "object",
                type: { name: "UserCreateInput" },
            });

            expect(result).toStrictEqual({
                items: { $ref: "#/components/schemas/UserCreateInput" },
                type: "array",
                xml: { name: "UserCreateInput", wrapped: true },
            });
        });

        it("should return scalar type for non-object kind", () => {
            expect.assertions(1);

            const parser = new PrismaJsonSchemaParser({});
            const result = parser.formatInputTypeData({ kind: "scalar", type: "Int" });

            expect(result).toStrictEqual({ type: "integer" });
        });

        it("should return wrapped array for list of scalars", () => {
            expect.assertions(2);

            const parser = new PrismaJsonSchemaParser({});
            const result = parser.formatInputTypeData({
                isList: true,
                kind: "scalar",
                type: "Float",
            }) as { items: { type: string }; type: string; xml: { wrapped: boolean } };

            expect(result.items.type).toBe("number");
            expect(result.type).toBe("array");
        });

        it.each([
            ["BigInt", "integer"],
            ["Int", "integer"],
            ["Boolean", "boolean"],
            ["String", "string"],
            ["DateTime", "string"],
            ["Bytes", "string"],
            ["Float", "number"],
            ["Decimal", "number"],
            ["Json", "object"],
            ["Null", "null"],
            ["Unknown", ""],
        ])("should map %s to %s", (input, expected) => {
            expect.assertions(1);

            const parser = new PrismaJsonSchemaParser({});
            const result = parser.formatInputTypeData({ kind: "scalar", type: input });

            expect(result).toStrictEqual({ type: expected });
        });
    });

    describe("parseObjectInputType", () => {
        it("should cache visited inputTypes and return $ref", () => {
            expect.assertions(1);

            const parser = new PrismaJsonSchemaParser({});
            const fieldType = {
                kind: "object",
                type: {
                    fields: [
                        {
                            inputTypes: [{ kind: "scalar", type: "String" }],
                            name: "name",
                        },
                    ],
                    name: "UserInput",
                },
            };

            const result = parser.parseObjectInputType(fieldType);

            expect(result).toStrictEqual({ $ref: "#/components/schemas/UserInput" });
        });

        it("should handle nullable union inputTypes", () => {
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
                    name: "NullableInput",
                },
            };

            const result = parser.parseObjectInputType(fieldType);

            expect(result).toStrictEqual({ $ref: "#/components/schemas/NullableInput" });
        });

        it("should return scalar type when fieldType.kind is scalar", () => {
            expect.assertions(1);

            const parser = new PrismaJsonSchemaParser({});
            const result = parser.parseObjectInputType({ kind: "scalar", type: "Int" });

            expect(result).toStrictEqual({ type: "integer" });
        });
    });
});
