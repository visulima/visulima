import { describe, expect, it } from "vitest";

import organizeSwaggerObject from "../../src/swagger-jsdoc/organize-swagger-object";

const swaggerObject = {
    info: {
        title: "Hello World",
        version: "1.0.0",
        description: "A sample API",
    },
    host: "localhost:3000",
    basePath: "/",
    swagger: "2.0",
    schemes: [],
    consumes: [],
    produces: [],
    paths: {},
    definitions: {},
    responses: {},
    parameters: {},
    securityDefinitions: {},
    security: {},
    tags: [],
    externalDocs: {},
};

describe("organize", () => {
    it('should handle "definitions"', () => {
        const annotation = {
            definitions: {
                testDefinition: {
                    required: ["username", "password"],
                    properties: {
                        username: {
                            type: "string",
                        },
                        password: {
                            type: "string",
                        },
                    },
                },
            },
        };

        organizeSwaggerObject(swaggerObject, annotation, "definitions");

        expect(swaggerObject.definitions).toEqual({
            testDefinition: {
                required: ["username", "password"],
                properties: {
                    username: { type: "string" },
                    password: { type: "string" },
                },
            },
        });
    });

    it('should handle "parameters"', () => {
        const annotation = {
            parameters: {
                testParameter: {
                    name: "limit",
                    in: "query",
                    description: "max records to return",
                    required: true,
                    type: "integer",
                    format: "int32",
                },
            },
        };

        organizeSwaggerObject(swaggerObject, annotation, "parameters");

        expect(swaggerObject.parameters).toEqual({
            testParameter: {
                name: "limit",
                in: "query",
                description: "max records to return",
                required: true,
                type: "integer",
                format: "int32",
            },
        });
    });

    it('should handle "securityDefinitions"', () => {
        const annotation = {
            securityDefinitions: {
                basicAuth: {
                    type: "basic",
                    description: "HTTP Basic Authentication. Works over `HTTP` and `HTTPS`",
                },
            },
        };

        organizeSwaggerObject(swaggerObject, annotation, "securityDefinitions");

        expect(swaggerObject.securityDefinitions).toEqual({
            basicAuth: {
                type: "basic",
                description: "HTTP Basic Authentication. Works over `HTTP` and `HTTPS`",
            },
        });
    });

    it('should handle "responses"', () => {
        const annotation = {
            responses: {
                IllegalInput: {
                    description: "Illegal input for operation.",
                },
            },
        };

        organizeSwaggerObject(swaggerObject, annotation, "responses");

        expect(swaggerObject.responses).toEqual({
            IllegalInput: { description: "Illegal input for operation." },
        });
    });

    it('should handle "security"', () => {
        const annotation = {
            security: [
                {
                    bearerAuth: [],
                },
            ],
        };

        organizeSwaggerObject(swaggerObject, annotation, "security");

        expect(swaggerObject.security).toEqual([
            {
                bearerAuth: [],
            },
        ]);
    });
});
