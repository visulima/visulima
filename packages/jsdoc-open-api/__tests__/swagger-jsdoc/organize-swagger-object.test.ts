import { describe, expect, it } from "vitest";

import organizeSwaggerObject from "../../src/swagger-jsdoc/organize-swagger-object";

const swaggerObject = {
    basePath: "/",
    consumes: [],
    definitions: {},
    externalDocs: {},
    host: "localhost:3000",
    info: {
        description: "A sample API",
        title: "Hello World",
        version: "1.0.0",
    },
    parameters: {},
    paths: {},
    produces: [],
    responses: {},
    schemes: [],
    security: {},
    securityDefinitions: {},
    swagger: "2.0",
    tags: [],
};

describe("organize", () => {
    it("should handle \"definitions\"", () => {
        expect.assertions(1);

        const annotation = {
            definitions: {
                testDefinition: {
                    properties: {
                        password: {
                            type: "string",
                        },
                        username: {
                            type: "string",
                        },
                    },
                    required: ["username", "password"],
                },
            },
        };

        organizeSwaggerObject(swaggerObject, annotation, "definitions");

        expect(swaggerObject.definitions).toStrictEqual({
            testDefinition: {
                properties: {
                    password: { type: "string" },
                    username: { type: "string" },
                },
                required: ["username", "password"],
            },
        });
    });

    it("should handle \"parameters\"", () => {
        expect.assertions(1);

        const annotation = {
            parameters: {
                testParameter: {
                    description: "max records to return",
                    format: "int32",
                    in: "query",
                    name: "limit",
                    required: true,
                    type: "integer",
                },
            },
        };

        organizeSwaggerObject(swaggerObject, annotation, "parameters");

        expect(swaggerObject.parameters).toStrictEqual({
            testParameter: {
                description: "max records to return",
                format: "int32",
                in: "query",
                name: "limit",
                required: true,
                type: "integer",
            },
        });
    });

    it("should handle \"securityDefinitions\"", () => {
        expect.assertions(1);

        const annotation = {
            securityDefinitions: {
                basicAuth: {
                    description: "HTTP Basic Authentication. Works over `HTTP` and `HTTPS`",
                    type: "basic",
                },
            },
        };

        organizeSwaggerObject(swaggerObject, annotation, "securityDefinitions");

        expect(swaggerObject.securityDefinitions).toStrictEqual({
            basicAuth: {
                description: "HTTP Basic Authentication. Works over `HTTP` and `HTTPS`",
                type: "basic",
            },
        });
    });

    it("should handle \"responses\"", () => {
        expect.assertions(1);

        const annotation = {
            responses: {
                IllegalInput: {
                    description: "Illegal input for operation.",
                },
            },
        };

        organizeSwaggerObject(swaggerObject, annotation, "responses");

        expect(swaggerObject.responses).toStrictEqual({
            IllegalInput: { description: "Illegal input for operation." },
        });
    });

    it("should handle \"security\"", () => {
        expect.assertions(1);

        const annotation = {
            security: [
                {
                    bearerAuth: [],
                },
            ],
        };

        organizeSwaggerObject(swaggerObject, annotation, "security");

        expect(swaggerObject.security).toStrictEqual([
            {
                bearerAuth: [],
            },
        ]);
    });
});
