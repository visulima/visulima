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

        it("appends null to both the type and the enum list for an optional enum", () => {
            expect.assertions(1);

            const [, property] = transform(createField({ kind: "enum", name: "role", type: "Role" }));

            expect(property).toStrictEqual({
                enum: ["USER", "ADMIN", null],
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

    describe("enum list fields", () => {
        it("attaches the enum members to array items, not the array itself", () => {
            expect.assertions(1);

            const [, property] = transform(createField({ isList: true, isRequired: true, kind: "enum", name: "roles", type: "Role" }));

            expect(property).toStrictEqual({
                items: { enum: ["USER", "ADMIN"], type: "string" },
                type: "array",
            });
        });

        it("does not append null to a required enum list", () => {
            expect.assertions(1);

            const [, property] = transform(createField({ isList: true, isRequired: false, kind: "enum", name: "roles", type: "Role" }));

            // List fields are never nullable in Prisma, so no `null` is added.
            expect(property).toStrictEqual({
                items: { enum: ["USER", "ADMIN"], type: "string" },
                type: "array",
            });
        });
    });

    describe("required enum fields", () => {
        it("does not append null for a required enum", () => {
            expect.assertions(1);

            const [, property] = transform(createField({ isRequired: true, kind: "enum", name: "role", type: "Role" }));

            expect(property).toStrictEqual({
                enum: ["USER", "ADMIN"],
                type: "string",
            });
        });
    });

    describe("bigIntType option", () => {
        it("maps BigInt to string when bigIntType is 'string'", () => {
            expect.assertions(1);

            const [, property] = transform(createField({ default: "34534535435353", hasDefaultValue: true, isRequired: true, name: "count", type: "BigInt" }), {
                bigIntType: "string",
            });

            expect(property).toStrictEqual({ default: "34534535435353", type: "string" });
        });

        it("defaults BigInt to integer", () => {
            expect.assertions(1);

            const [, property] = transform(createField({ isRequired: true, name: "count", type: "BigInt" }));

            expect(property).toStrictEqual({ type: "integer" });
        });
    });

    describe("boolean-like options", () => {
        it("treats a native boolean true the same as the string 'true'", () => {
            expect.assertions(1);

            const [, property] = transform(createField({ isRequired: true, name: "id", type: "Int" }), { persistOriginalType: true });

            expect(property).toStrictEqual({ originalType: "Int", type: "integer" });
        });
    });

    describe("nullableMode 'openapi'", () => {
        it("emits nullable: true instead of a type union for an optional scalar", () => {
            expect.assertions(1);

            const [, property] = transform(createField({ name: "name", type: "String" }), { nullableMode: "openapi" });

            expect(property).toStrictEqual({ nullable: true, type: "string" });
        });

        it("emits nullable: true on a reference instead of anyOf null", () => {
            expect.assertions(1);

            const [, property] = transform(createField({ kind: "object", name: "author", type: "User" }), { nullableMode: "openapi" });

            expect(property).toStrictEqual({ $ref: "#/definitions/User", nullable: true });
        });

        it("does not append null to the enum list in openapi mode", () => {
            expect.assertions(1);

            const [, property] = transform(createField({ kind: "enum", name: "role", type: "Role" }), { nullableMode: "openapi" });

            expect(property).toStrictEqual({ enum: ["USER", "ADMIN"], nullable: true, type: "string" });
        });
    });

    describe("enrichNativeTypes option", () => {
        it("adds maxLength from @db.VarChar", () => {
            expect.assertions(1);

            const [, property] = transform(createField({ isRequired: true, name: "title", nativeType: ["VarChar", ["255"]], type: "String" }), {
                enrichNativeTypes: true,
            });

            expect(property).toStrictEqual({ maxLength: 255, type: "string" });
        });

        it("adds format uuid for a uuid() default", () => {
            expect.assertions(1);

            const [, property] = transform(
                createField({ default: { args: [], name: "uuid" }, hasDefaultValue: true, isRequired: true, name: "id", type: "String" }),
                { enrichNativeTypes: true },
            );

            expect(property).toStrictEqual({ format: "uuid", type: "string" });
        });

        it("adds contentEncoding base64 for Bytes", () => {
            expect.assertions(1);

            const [, property] = transform(createField({ isRequired: true, name: "blob", type: "Bytes" }), { enrichNativeTypes: true });

            expect(property).toStrictEqual({ contentEncoding: "base64", type: "string" });
        });

        it("does not enrich when the option is disabled", () => {
            expect.assertions(1);

            const [, property] = transform(createField({ isRequired: true, name: "blob", type: "Bytes" }));

            expect(property).toStrictEqual({ type: "string" });
        });
    });
});
