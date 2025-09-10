import prismaInternal from "@prisma/internals";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";

import { transformDMMF } from "../src";

const datamodelPostGresQL = /* Prisma */ `
	datasource db {
		provider = "postgresql"
		url      = env("DATABASE_URL")
	}

	model User {
		id                  Int      @id @default(autoincrement())
        // Double Slash Comment: Will NOT show up in JSON schema
		createdAt           DateTime @default(now())
        /// Triple Slash Comment: Will show up in JSON schema [EMAIL]
		email               String   @unique
        number              BigInt   @default(34534535435353)
        favouriteDecimal    Decimal  @default(22.222222)
        bytes               Bytes /// Triple Slash Inline Comment: Will show up in JSON schema [BYTES]
		weight              Float?   @default(333.33)
		is18                Boolean? @default(false)
		name                String?  @default("Bela B")
		successorId         Int?     @default(123) @unique
		successor           User?    @relation("BlogOwnerHistory", fields: [successorId], references: [id])
		predecessor         User?    @relation("BlogOwnerHistory")
		role                Role     @default(USER)
		dwmc                String?  @default("") @db.VarChar(50)
		posts               Post[]
        keywords            String[]
        biography           Json
	}

	model Post {
		id     Int   @id @default(autoincrement())
		user   User? @relation(fields: [userId], references: [id])
		userId Int?
	}

	enum Role {
		USER
		ADMIN
	}
`;

const datamodelMongoDB = /* Prisma */ `
    datasource db {
		provider = "mongodb"
		url      = env("DATABASE_URL")
	}

    model User {
		id      String @id @default(auto()) @map("_id") @db.ObjectId
        photos  Photo[]
	}

    type Photo {
        height Int      @default(200)
        width  Int      @default(100)
        url    String
    }
`;
const schema = "http://json-schema.org/draft-07/schema#";

describe("jSON Schema Generator", () => {
    describe("db postgresql", () => {
        it("returns JSON Schema for given models", async () => {
            expect.assertions(1);

            const dmmf = await prismaInternal.getDMMF({ datamodel: datamodelPostGresQL });

            expect(transformDMMF(dmmf)).toStrictEqual({
                $schema: schema,
                definitions: {
                    Post: {
                        properties: {
                            id: { type: "integer" },
                            user: {
                                anyOf: [{ $ref: "#/definitions/User" }, { type: "null" }],
                            },
                        },
                        type: "object",
                    },
                    User: {
                        properties: {
                            biography: {
                                type: ["number", "string", "boolean", "object", "array", "null"],
                            },
                            bytes: {
                                description: "Triple Slash Inline Comment: Will show up in JSON schema [BYTES]",
                                type: "string",
                            },
                            createdAt: { format: "date-time", type: "string" },
                            dwmc: { default: "", type: ["string", "null"] },
                            email: {
                                description: "Triple Slash Comment: Will show up in JSON schema [EMAIL]",
                                type: "string",
                            },
                            favouriteDecimal: {
                                default: 22.222_222,
                                type: "number",
                            },
                            id: { type: "integer" },
                            is18: { default: false, type: ["boolean", "null"] },
                            keywords: {
                                items: { type: "string" },
                                type: "array",
                            },
                            name: {
                                default: "Bela B",
                                type: ["string", "null"],
                            },
                            number: {
                                default: "34534535435353",
                                type: "integer",
                            },
                            posts: {
                                items: { $ref: "#/definitions/Post" },
                                type: "array",
                            },
                            predecessor: {
                                anyOf: [{ $ref: "#/definitions/User" }, { type: "null" }],
                            },
                            role: {
                                default: "USER",
                                enum: ["USER", "ADMIN"],
                                type: "string",
                            },
                            successor: {
                                anyOf: [{ $ref: "#/definitions/User" }, { type: "null" }],
                            },
                            weight: {
                                default: 333.33,
                                type: ["number", "null"],
                            },
                        },
                        type: "object",
                    },
                },
                properties: {
                    post: { $ref: "#/definitions/Post" },
                    user: { $ref: "#/definitions/User" },
                },
                type: "object",
            });
        });

        it("keeps relation scalar fields if requested", async () => {
            expect.assertions(1);

            const dmmf = await prismaInternal.getDMMF({ datamodel: datamodelPostGresQL });

            expect(transformDMMF(dmmf, { keepRelationScalarFields: "true" })).toStrictEqual({
                $schema: schema,
                definitions: {
                    Post: {
                        properties: {
                            id: { type: "integer" },
                            user: {
                                anyOf: [{ $ref: "#/definitions/User" }, { type: "null" }],
                            },
                            userId: {
                                type: ["integer", "null"],
                            },
                        },
                        type: "object",
                    },
                    User: {
                        properties: {
                            biography: {
                                type: ["number", "string", "boolean", "object", "array", "null"],
                            },
                            bytes: {
                                description: "Triple Slash Inline Comment: Will show up in JSON schema [BYTES]",
                                type: "string",
                            },
                            createdAt: { format: "date-time", type: "string" },
                            dwmc: { default: "", type: ["string", "null"] },
                            email: {
                                description: "Triple Slash Comment: Will show up in JSON schema [EMAIL]",
                                type: "string",
                            },
                            favouriteDecimal: {
                                default: 22.222_222,
                                type: "number",
                            },
                            id: { type: "integer" },
                            is18: { default: false, type: ["boolean", "null"] },
                            keywords: {
                                items: { type: "string" },
                                type: "array",
                            },
                            name: {
                                default: "Bela B",
                                type: ["string", "null"],
                            },
                            number: {
                                default: "34534535435353",
                                type: "integer",
                            },
                            posts: {
                                items: { $ref: "#/definitions/Post" },
                                type: "array",
                            },
                            predecessor: {
                                anyOf: [{ $ref: "#/definitions/User" }, { type: "null" }],
                            },
                            role: {
                                default: "USER",
                                enum: ["USER", "ADMIN"],
                                type: "string",
                            },
                            successor: {
                                anyOf: [{ $ref: "#/definitions/User" }, { type: "null" }],
                            },
                            successorId: {
                                default: 123,
                                type: ["integer", "null"],
                            },
                            weight: {
                                default: 333.33,
                                type: ["number", "null"],
                            },
                        },
                        type: "object",
                    },
                },
                properties: {
                    post: { $ref: "#/definitions/Post" },
                    user: { $ref: "#/definitions/User" },
                },
                type: "object",
            });
        });

        it("adds required field if requested", async () => {
            expect.assertions(1);

            const dmmf = await prismaInternal.getDMMF({ datamodel: datamodelPostGresQL });

            expect(transformDMMF(dmmf, { includeRequiredFields: "true" })).toStrictEqual({
                $schema: schema,
                definitions: {
                    Post: {
                        properties: {
                            id: { type: "integer" },
                            user: {
                                anyOf: [{ $ref: "#/definitions/User" }, { type: "null" }],
                            },
                        },
                        required: [],
                        type: "object",
                    },
                    User: {
                        properties: {
                            biography: {
                                type: ["number", "string", "boolean", "object", "array", "null"],
                            },
                            bytes: {
                                description: "Triple Slash Inline Comment: Will show up in JSON schema [BYTES]",
                                type: "string",
                            },
                            createdAt: { format: "date-time", type: "string" },
                            dwmc: { default: "", type: ["string", "null"] },
                            email: {
                                description: "Triple Slash Comment: Will show up in JSON schema [EMAIL]",
                                type: "string",
                            },
                            favouriteDecimal: {
                                default: 22.222_222,
                                type: "number",
                            },
                            id: { type: "integer" },
                            is18: { default: false, type: ["boolean", "null"] },
                            keywords: {
                                items: { type: "string" },
                                type: "array",
                            },
                            name: {
                                default: "Bela B",
                                type: ["string", "null"],
                            },
                            number: {
                                default: "34534535435353",
                                type: "integer",
                            },
                            posts: {
                                items: { $ref: "#/definitions/Post" },
                                type: "array",
                            },
                            predecessor: {
                                anyOf: [{ $ref: "#/definitions/User" }, { type: "null" }],
                            },
                            role: {
                                default: "USER",
                                enum: ["USER", "ADMIN"],
                                type: "string",
                            },
                            successor: {
                                anyOf: [{ $ref: "#/definitions/User" }, { type: "null" }],
                            },
                            weight: {
                                default: 333.33,
                                type: ["number", "null"],
                            },
                        },
                        required: ["email", "bytes", "keywords", "biography"],
                        type: "object",
                    },
                },
                properties: {
                    post: { $ref: "#/definitions/Post" },
                    user: { $ref: "#/definitions/User" },
                },
                type: "object",
            });
        });

        it("adds original type if requested", async () => {
            expect.assertions(1);

            const dmmf = await prismaInternal.getDMMF({ datamodel: datamodelPostGresQL });

            expect(transformDMMF(dmmf, { persistOriginalType: "true" })).toStrictEqual({
                $schema: schema,
                definitions: {
                    Post: {
                        properties: {
                            id: { originalType: "Int", type: "integer" },
                            user: {
                                anyOf: [{ $ref: "#/definitions/User" }, { type: "null" }],
                                originalType: "User",
                            },
                        },
                        type: "object",
                    },
                    User: {
                        properties: {
                            biography: {
                                originalType: "Json",
                                type: ["number", "string", "boolean", "object", "array", "null"],
                            },
                            bytes: {
                                description: "Triple Slash Inline Comment: Will show up in JSON schema [BYTES]",
                                originalType: "Bytes",
                                type: "string",
                            },
                            createdAt: {
                                format: "date-time",
                                originalType: "DateTime",
                                type: "string",
                            },
                            dwmc: {
                                default: "",
                                originalType: "String",
                                type: ["string", "null"],
                            },
                            email: {
                                description: "Triple Slash Comment: Will show up in JSON schema [EMAIL]",
                                originalType: "String",
                                type: "string",
                            },
                            favouriteDecimal: {
                                default: 22.222_222,
                                originalType: "Decimal",
                                type: "number",
                            },
                            id: { originalType: "Int", type: "integer" },
                            is18: {
                                default: false,
                                originalType: "Boolean",
                                type: ["boolean", "null"],
                            },
                            keywords: {
                                items: { type: "string" },
                                originalType: "String",
                                type: "array",
                            },
                            name: {
                                default: "Bela B",
                                originalType: "String",
                                type: ["string", "null"],
                            },
                            number: {
                                default: "34534535435353",
                                originalType: "BigInt",
                                type: "integer",
                            },
                            posts: {
                                items: { $ref: "#/definitions/Post" },
                                originalType: "Post",
                                type: "array",
                            },
                            predecessor: {
                                anyOf: [{ $ref: "#/definitions/User" }, { type: "null" }],
                                originalType: "User",
                            },
                            role: {
                                default: "USER",
                                enum: ["USER", "ADMIN"],
                                originalType: "Role",
                                type: "string",
                            },
                            successor: {
                                anyOf: [{ $ref: "#/definitions/User" }, { type: "null" }],
                                originalType: "User",
                            },
                            weight: {
                                default: 333.33,
                                originalType: "Float",
                                type: ["number", "null"],
                            },
                        },
                        type: "object",
                    },
                },
                properties: {
                    post: { $ref: "#/definitions/Post" },
                    user: { $ref: "#/definitions/User" },
                },
                type: "object",
            });
        });

        it("adds schema id", async () => {
            expect.assertions(1);

            const dmmf = await prismaInternal.getDMMF({ datamodel: datamodelPostGresQL });

            expect(
                transformDMMF(dmmf, {
                    keepRelationScalarFields: "true",
                    schemaId: "schemaId",
                }),
            ).toStrictEqual({
                $id: "schemaId",
                $schema: schema,
                definitions: {
                    Post: {
                        properties: {
                            id: { type: "integer" },
                            user: {
                                anyOf: [{ $ref: "schemaId#/definitions/User" }, { type: "null" }],
                            },
                            userId: {
                                type: ["integer", "null"],
                            },
                        },
                        type: "object",
                    },
                    User: {
                        properties: {
                            biography: {
                                type: ["number", "string", "boolean", "object", "array", "null"],
                            },
                            bytes: {
                                description: "Triple Slash Inline Comment: Will show up in JSON schema [BYTES]",
                                type: "string",
                            },
                            createdAt: { format: "date-time", type: "string" },
                            dwmc: { default: "", type: ["string", "null"] },
                            email: {
                                description: "Triple Slash Comment: Will show up in JSON schema [EMAIL]",
                                type: "string",
                            },
                            favouriteDecimal: {
                                default: 22.222_222,
                                type: "number",
                            },
                            id: { type: "integer" },
                            is18: { default: false, type: ["boolean", "null"] },
                            keywords: {
                                items: { type: "string" },
                                type: "array",
                            },
                            name: {
                                default: "Bela B",
                                type: ["string", "null"],
                            },
                            number: {
                                default: "34534535435353",
                                type: "integer",
                            },
                            posts: {
                                items: { $ref: "schemaId#/definitions/Post" },
                                type: "array",
                            },
                            predecessor: {
                                anyOf: [{ $ref: "schemaId#/definitions/User" }, { type: "null" }],
                            },
                            role: {
                                default: "USER",
                                enum: ["USER", "ADMIN"],
                                type: "string",
                            },
                            successor: {
                                anyOf: [{ $ref: "schemaId#/definitions/User" }, { type: "null" }],
                            },
                            successorId: {
                                default: 123,
                                type: ["integer", "null"],
                            },
                            weight: {
                                default: 333.33,
                                type: ["number", "null"],
                            },
                        },
                        type: "object",
                    },
                },
                properties: {
                    post: { $ref: "schemaId#/definitions/Post" },
                    user: { $ref: "schemaId#/definitions/User" },
                },
                type: "object",
            });
        });

        it("generated schema validates against input", async () => {
            expect.assertions(1);

            const dmmf = await prismaInternal.getDMMF({ datamodel: datamodelPostGresQL });
            const jsonSchema = transformDMMF(dmmf, {
                persistOriginalType: "true",
            });
            const ajv = new Ajv({
                allowUnionTypes: true,
            }).addKeyword("originalType");

            addFormats(ajv);

            const validate = ajv.compile(jsonSchema);
            const valid = validate({
                post: {
                    id: 0,
                    user: {
                        id: 100,
                    },
                },
                user: {
                    biography: {
                        bornIn: "Scharnow",
                    },
                    bytes: "SGVsbG8gd29ybGQ=",
                    createdAt: "1997-07-16T19:20:30.45+01:00",
                    email: "jan@scharnow.city",
                    favouriteDecimal: 22.32,
                    id: 10,
                    is18: true,
                    keywords: ["prisma2", "json-schema", "generator"],
                    name: null,
                    number: 34_534_535_435_353,
                    posts: [
                        {
                            id: 4,
                        },
                        {
                            id: 20,
                        },
                    ],
                    predecessor: {
                        email: "horst@wassermann.de",
                        id: 10,
                    },
                    role: "USER",
                    successor: null,
                    weight: 10.12,
                },
            });

            expect(valid, ajv.errorsText(validate.errors)).toBe(true);
        });
    });

    describe("db mongodb", () => {
        it("returns JSON schema for given models", async () => {
            expect.assertions(1);

            const dmmf = await prismaInternal.getDMMF({ datamodel: datamodelMongoDB });

            expect(transformDMMF(dmmf)).toStrictEqual({
                $schema: schema,
                definitions: {
                    Photo: {
                        properties: {
                            height: {
                                default: 200,
                                type: "integer",
                            },
                            url: {
                                type: "string",
                            },
                            width: {
                                default: 100,
                                type: "integer",
                            },
                        },
                        type: "object",
                    },
                    User: {
                        properties: {
                            id: { type: "string" },
                            photos: {
                                items: { $ref: "#/definitions/Photo" },
                                type: "array",
                            },
                        },
                        type: "object",
                    },
                },
                properties: {
                    user: { $ref: "#/definitions/User" },
                },
                type: "object",
            });
        });
    });
});
