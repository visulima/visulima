import { describe, expect, it } from "vitest";

import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import SpecBuilder from "../../../src/generator/spec-builder";

describe("specBuilder", () => {
    it("should create SpecBuilder with valid OpenAPIV2.Document object", () => {
        const baseDefinition: Partial<OpenAPIV2.Document> = {
            info: {
                title: "Test API",
                version: "1.0.0",
            },
            paths: {},
            swagger: "2.0",
        };

        const specBuilder = new SpecBuilder(baseDefinition);

        expect(specBuilder.openapi).toBeUndefined();
        expect(specBuilder.swagger).toBe("2.0");
        expect(specBuilder.info).toStrictEqual({
            title: "Test API",
            version: "1.0.0",
        });
        expect(specBuilder.paths).toStrictEqual({});
    });

    it("should create SpecBuilder with valid OpenAPIV3_1.Document object", () => {
        const baseDefinition: Partial<OpenAPIV3_1.Document> = {
            info: {
                title: "Test API",
                version: "1.0.0",
            },
            openapi: "3.1.0",
            paths: {},
        };

        const specBuilder = new SpecBuilder(baseDefinition);

        expect(specBuilder.openapi).toBe("3.1.0");
        expect(specBuilder.swagger).toBeUndefined();
        expect(specBuilder.info).toStrictEqual({
            title: "Test API",
            version: "1.0.0",
        });
        expect(specBuilder.paths).toStrictEqual({});
    });

    it("should create SpecBuilder with valid OpenAPIV3.Document object", () => {
        const baseDefinition: Partial<OpenAPIV3.Document> = {
            info: {
                title: "Test API",
                version: "1.0.0",
            },
            openapi: "3.0.3",
            paths: {},
        };

        const specBuilder = new SpecBuilder(baseDefinition);

        expect(specBuilder.openapi).toBe("3.0.3");
        expect(specBuilder.swagger).toBeUndefined();
        expect(specBuilder.info).toStrictEqual({
            title: "Test API",
            version: "1.0.0",
        });
        expect(specBuilder.paths).toStrictEqual({});
    });

    it("should add valid OpenAPIV2.Document object to existing SpecBuilder instance", () => {
        const baseDefinition: Partial<OpenAPIV2.Document> = {
            info: {
                title: "Test API",
                version: "1.0.0",
            },
            swagger: "2.0",
        };

        const specBuilder = new SpecBuilder(baseDefinition);

        const data: OpenAPIV2.Document = {
            info: {
                title: "Updated API",
                version: "2.0.0",
            },
            paths: {},
            swagger: "2.0",
        };

        specBuilder.addData(data);

        expect(specBuilder.openapi).toBeUndefined();
        expect(specBuilder.swagger).toBe("2.0");
        expect(specBuilder.info).toStrictEqual({
            title: "Updated API",
            version: "2.0.0",
        });
    });

    it("should add valid OpenAPIV3_1.Document object to existing SpecBuilder instance", () => {
        const baseDefinition: Partial<OpenAPIV3.Document> = {
            info: {
                title: "Test API",
                version: "1.0.0",
            },
            openapi: "3.1.0",
            paths: {},
        };

        const specBuilder = new SpecBuilder(baseDefinition);

        const data: OpenAPIV3_1.Document = {
            info: {
                title: "Updated API",
                version: "2.0.0",
            },
            openapi: "3.1.0",
            paths: {},
        };

        specBuilder.addData(data);

        expect(specBuilder.openapi).toBe("3.1.0");
        expect(specBuilder.swagger).toBeUndefined();
        expect(specBuilder.info).toStrictEqual({
            title: "Updated API",
            version: "2.0.0",
        });
        expect(specBuilder.paths).toStrictEqual({});
    });

    // Tests that a valid OpenAPIV3.Document object can be added to an existing instance of SpecBuilder.
    it("should add valid OpenAPIV3.Document object to existing SpecBuilder instance", () => {
        const baseDefinition: Partial<OpenAPIV3.Document> = {
            info: {
                title: "Test API",
                version: "1.0.0",
            },
            openapi: "3.0.3",
            paths: {},
        };

        const specBuilder = new SpecBuilder(baseDefinition);

        const data: OpenAPIV3.Document = {
            info: {
                title: "Updated API",
                version: "2.0.0",
            },
            openapi: "3.0.3",
            paths: {},
        };

        specBuilder.addData(data);

        expect(specBuilder.openapi).toBe("3.0.3");
        expect(specBuilder.swagger).toBeUndefined();
        expect(specBuilder.info).toStrictEqual({
            title: "Updated API",
            version: "2.0.0",
        });
        expect(specBuilder.paths).toStrictEqual({});
    });

    // Tests that SpecBuilder throws an error when created with an object containing an unsupported version.
    it("should throw an error when created with an object containing an unsupported version", () => {
        const baseDefinition: Partial<OpenAPIV3.Document> = {
            info: {
                title: "Test API",
                version: "1.0.0",
            },
            openapi: "4.0.0",
            paths: {},
        };

        expect(() => new SpecBuilder(baseDefinition)).toThrow("Cannot merge openapi, the version 4.0.0 is not supported.");
    });

    it("should throw an error when created with an object containing a mix of swagger v2 and openapi v3", () => {
        const baseDefinition = {
            info: {
                title: "Test API",
                version: "1.0.0",
            },
            openapi: "3.0.3",
            paths: {},
            swagger: "2.0",
        };

        expect(() => new SpecBuilder(baseDefinition)).toThrow("Cannot merge swagger, you cant mix swagger v2 and swagger v3.");
    });

    it("should throw an error when adding an object with an unsupported version", () => {
        const baseDefinition: Partial<OpenAPIV3.Document> = {
            info: {
                title: "Test API",
                version: "1.0.0",
            },
            paths: {},
        };

        const specBuilder = new SpecBuilder(baseDefinition);

        const data: OpenAPIV3.Document = {
            info: {
                title: "Updated API",
                version: "2.0.0",
            },
            openapi: "4.0.0",
            paths: {},
        };

        expect(() => specBuilder.addData(data)).toThrow("Cannot merge openapi, the version 4.0.0 is not supported.");
    });

    it("should not throw an error when adding an object with a different openapi versions between 3.0.0 and 3.0.3", () => {
        const baseDefinition: Partial<OpenAPIV3.Document> = {
            info: {
                title: "Test API",
                version: "1.0.0",
            },
            openapi: "3.0.3",
            paths: {},
        };

        const specBuilder = new SpecBuilder(baseDefinition);

        expect(() =>
            specBuilder.addData({
                openapi: "3.0.1",
            }),
        ).not.toThrow("Cannot merge openapi, the versions do not match.");
        expect(() =>
            specBuilder.addData({
                openapi: "3.0.2",
            }),
        ).not.toThrow("Cannot merge openapi, the versions do not match.");
        expect(() =>
            specBuilder.addData({
                openapi: "3.0.3",
            }),
        ).not.toThrow("Cannot merge openapi, the versions do not match.");
    });
});
