import type { DMMF } from "@prisma/generator-helper";
import { describe, expect, it } from "vitest";

import type { ModelMetaData, TransformOptions } from "../src";
import { getJSONSchemaProperty } from "../src";

const enumMetaData: ModelMetaData = {
    enums: [
        {
            dbName: null,
            name: "Role",
            values: [
                { dbName: null, name: "USER" },
                { dbName: null, name: "ADMIN" },
            ],
        },
    ],
};

const createField = (overrides: Partial<DMMF.Field> & Pick<DMMF.Field, "name" | "type">): DMMF.Field => {
    return {
        hasDefaultValue: false,
        isGenerated: false,
        isId: false,
        isList: false,
        isReadOnly: false,
        isRequired: false,
        isUnique: false,
        isUpdatedAt: false,
        kind: "scalar",
        ...overrides,
    };
};

const transform = (field: DMMF.Field, options: TransformOptions = {}, metaData: ModelMetaData = enumMetaData) =>
    getJSONSchemaProperty(metaData, options)(field);

describe(getJSONSchemaProperty, () => {
    describe("nullable union types", () => {
        it("merges null into the union for an optional Json scalar", () => {
            expect.assertions(1);

            const [, property] = transform(createField({ name: "biography", type: "Json" }));

            expect(property).toStrictEqual({
                type: ["null", "number", "string", "boolean", "object", "array"],
            });
        });

        it("appends null to a single scalar type for an optional enum", () => {
            expect.assertions(1);

            const [, property] = transform(createField({ kind: "enum", name: "role", type: "Role" }));

            expect(property).toStrictEqual({
                enum: ["USER", "ADMIN"],
                type: ["string", "null"],
            });
        });
    });

    describe("scalar mapping", () => {
        it("throws for an unhandled scalar type", () => {
            expect.assertions(1);

            expect(() => transform(createField({ isRequired: true, name: "weird", type: "Geometry" }))).toThrow(
                "Unhandled discriminated union member: \"Geometry\"",
            );
        });
    });

    describe("default value handling", () => {
        it("ignores a default value on a relation (object) field", () => {
            expect.assertions(1);

            const [, property] = transform(
                createField({
                    default: "ignored",
                    hasDefaultValue: true,
                    isRequired: true,
                    kind: "object",
                    name: "author",
                    type: "User",
                }),
            );

            expect(property).toStrictEqual({ $ref: "#/definitions/User" });
        });

        it("ignores a default value on a list relation (object) field", () => {
            expect.assertions(1);

            const [, property] = transform(
                createField({
                    default: "ignored",
                    hasDefaultValue: true,
                    isList: true,
                    kind: "object",
                    name: "posts",
                    type: "Post",
                }),
            );

            expect(property).toStrictEqual({
                items: { $ref: "#/definitions/Post" },
                type: "array",
            });
        });

        it("drops a default on a Bytes scalar", () => {
            expect.assertions(1);

            const [, property] = transform(
                createField({
                    default: "AQID",
                    hasDefaultValue: true,
                    isRequired: true,
                    name: "blob",
                    type: "Bytes",
                }),
            );

            expect(property).toStrictEqual({ type: "string" });
        });

        it("drops a default on a Json scalar", () => {
            expect.assertions(1);

            const [, property] = transform(
                createField({
                    default: "{}",
                    hasDefaultValue: true,
                    isRequired: true,
                    name: "meta",
                    type: "Json",
                }),
            );

            expect(property).toStrictEqual({
                type: ["number", "string", "boolean", "object", "array", "null"],
            });
        });

        it("ignores a function default on a String scalar", () => {
            expect.assertions(1);

            const [, property] = transform(
                createField({
                    default: { args: [], name: "uuid" },
                    hasDefaultValue: true,
                    isRequired: true,
                    name: "id",
                    type: "String",
                }),
            );

            expect(property).toStrictEqual({ type: "string" });
        });

        it("ignores a non-boolean default on a Boolean scalar", () => {
            expect.assertions(1);

            const [, property] = transform(
                createField({
                    default: { args: [], name: "dbgenerated" },
                    hasDefaultValue: true,
                    isRequired: true,
                    name: "active",
                    type: "Boolean",
                }),
            );

            expect(property).toStrictEqual({ type: "boolean" });
        });

        it("ignores a function default on an Int scalar", () => {
            expect.assertions(1);

            const [, property] = transform(
                createField({
                    default: { args: [], name: "autoincrement" },
                    hasDefaultValue: true,
                    isRequired: true,
                    name: "id",
                    type: "Int",
                }),
            );

            expect(property).toStrictEqual({ type: "integer" });
        });

        it("ignores a non-string default on an enum field", () => {
            expect.assertions(1);

            const [, property] = transform(
                createField({
                    default: { args: [], name: "dbgenerated" },
                    hasDefaultValue: true,
                    isRequired: true,
                    kind: "enum",
                    name: "role",
                    type: "Role",
                }),
            );

            expect(property).toStrictEqual({
                enum: ["USER", "ADMIN"],
                type: "string",
            });
        });

        it("throws for an unhandled scalar type that carries a default", () => {
            expect.assertions(1);

            expect(() =>
                transform(
                    createField({
                        default: 1,
                        hasDefaultValue: true,
                        isRequired: true,
                        name: "weird",
                        type: "Geometry",
                    }),
                ),
            ).toThrow("Unhandled discriminated union member: \"Geometry\"");
        });
    });

    describe("enum resolution", () => {
        it("omits the enum list when the field type is not a known enum", () => {
            expect.assertions(1);

            const [, property] = transform(createField({ isRequired: true, kind: "enum", name: "role", type: "Unknown" }));

            expect(property).toStrictEqual({ type: "string" });
        });
    });
});
