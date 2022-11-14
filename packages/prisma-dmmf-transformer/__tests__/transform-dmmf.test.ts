import { getDMMF } from "@prisma/internals";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";

import { transformDMMF } from "../src";

/* eslint-disable no-tabs */
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
/* eslint-enable no-tabs */

const schema = "http://json-schema.org/draft-07/schema#";

describe("JSON Schema Generator", () => {
    describe("db postgresql", () => {
        it("returns JSON Schema for given models", async () => {
            const dmmf = await getDMMF({ datamodel: datamodelPostGresQL });

            expect(transformDMMF(dmmf)).toEqual({
                $schema: schema,
                definitions: {
                    Post: {
                        properties: {
                            id: { type: "integer" },
                            user: {
                                // eslint-disable-next-line radar/no-duplicate-string
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
                            createdAt: { format: "date-time", type: "string" },
                            dwmc: { default: "", type: ["string", "null"] },
                            email: {
                                // eslint-disable-next-line radar/no-duplicate-string
                                description: "Triple Slash Comment: Will show up in JSON schema [EMAIL]",
                                type: "string",
                            },
                            number: {
                                type: "integer",
                                default: "34534535435353",
                            },
                            bytes: {
                                // eslint-disable-next-line radar/no-duplicate-string
                                description: "Triple Slash Inline Comment: Will show up in JSON schema [BYTES]",
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
                            posts: {
                                // eslint-disable-next-line radar/no-duplicate-string
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
            const dmmf = await getDMMF({ datamodel: datamodelPostGresQL });

            expect(transformDMMF(dmmf, { keepRelationScalarFields: "true" })).toEqual({
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
                            createdAt: { format: "date-time", type: "string" },
                            dwmc: { default: "", type: ["string", "null"] },
                            email: {
                                description: "Triple Slash Comment: Will show up in JSON schema [EMAIL]",
                                type: "string",
                            },
                            number: {
                                type: "integer",
                                default: "34534535435353",
                            },
                            bytes: {
                                description: "Triple Slash Inline Comment: Will show up in JSON schema [BYTES]",
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
            const dmmf = await getDMMF({ datamodel: datamodelPostGresQL });

            expect(transformDMMF(dmmf, { includeRequiredFields: "true" })).toEqual({
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
                        required: [],
                    },
                    User: {
                        properties: {
                            biography: {
                                type: ["number", "string", "boolean", "object", "array", "null"],
                            },
                            createdAt: { format: "date-time", type: "string" },
                            dwmc: { default: "", type: ["string", "null"] },
                            email: {
                                // eslint-disable-next-line radar/no-duplicate-string
                                description: "Triple Slash Comment: Will show up in JSON schema [EMAIL]",
                                type: "string",
                            },
                            number: {
                                type: "integer",
                                default: "34534535435353",
                            },
                            bytes: {
                                description: "Triple Slash Inline Comment: Will show up in JSON schema [BYTES]",
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
                        required: ["email", "bytes", "keywords", "biography"],
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
            const dmmf = await getDMMF({ datamodel: datamodelPostGresQL });

            expect(transformDMMF(dmmf, { persistOriginalType: "true" })).toEqual({
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
                            createdAt: {
                                originalType: "DateTime",
                                format: "date-time",
                                type: "string",
                            },
                            dwmc: {
                                default: "",
                                originalType: "String",
                                type: ["string", "null"],
                            },
                            email: {
                                originalType: "String",
                                description: "Triple Slash Comment: Will show up in JSON schema [EMAIL]",
                                type: "string",
                            },
                            number: {
                                type: "integer",
                                originalType: "BigInt",
                                default: "34534535435353",
                            },
                            bytes: {
                                originalType: "Bytes",
                                description: "Triple Slash Inline Comment: Will show up in JSON schema [BYTES]",
                                type: "string",
                            },
                            favouriteDecimal: {
                                default: 22.222_222,
                                originalType: "Decimal",
                                type: "number",
                            },
                            id: { type: "integer", originalType: "Int" },
                            is18: {
                                default: false,
                                type: ["boolean", "null"],
                                originalType: "Boolean",
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
                                originalType: "Role",
                                enum: ["USER", "ADMIN"],
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
            const dmmf = await getDMMF({ datamodel: datamodelPostGresQL });

            expect(
                transformDMMF(dmmf, {
                    keepRelationScalarFields: "true",
                    schemaId: "schemaId",
                }),
            ).toEqual({
                $id: "schemaId",
                $schema: schema,
                definitions: {
                    Post: {
                        properties: {
                            id: { type: "integer" },
                            user: {
                                // eslint-disable-next-line radar/no-duplicate-string
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
                            createdAt: { format: "date-time", type: "string" },
                            dwmc: { default: "", type: ["string", "null"] },
                            email: {
                                description: "Triple Slash Comment: Will show up in JSON schema [EMAIL]",
                                type: "string",
                            },
                            number: {
                                type: "integer",
                                default: "34534535435353",
                            },
                            bytes: {
                                description: "Triple Slash Inline Comment: Will show up in JSON schema [BYTES]",
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
            const dmmf = await getDMMF({ datamodel: datamodelPostGresQL });
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
                    id: 10,
                    createdAt: "1997-07-16T19:20:30.45+01:00",
                    email: "jan@scharnow.city",
                    biography: {
                        bornIn: "Scharnow",
                    },
                    number: 34_534_535_435_353,
                    bytes: "SGVsbG8gd29ybGQ=",
                    favouriteDecimal: 22.32,
                    is18: true,
                    keywords: ["prisma2", "json-schema", "generator"],
                    name: null,
                    posts: [
                        {
                            id: 4,
                        },
                        {
                            id: 20,
                        },
                    ],
                    predecessor: {
                        id: 10,
                        email: "horst@wassermann.de",
                    },
                    successor: null,
                    role: "USER",
                    weight: 10.12,
                },
            });

            if (!valid) {
                throw new Error(ajv.errorsText(validate.errors));
            }
        });
    });

    describe("db mongodb", () => {
        it("returns JSON schema for given models", async () => {
            const dmmf = await getDMMF({ datamodel: datamodelMongoDB });

            expect(transformDMMF(dmmf)).toEqual({
                $schema: schema,
                definitions: {
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
                    Photo: {
                        properties: {
                            height: {
                                type: "integer",
                                default: 200,
                            },
                            width: {
                                type: "integer",
                                default: 100,
                            },
                            url: {
                                type: "string",
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
