import { describe, expect, it } from "vitest";

import {
    getOrganizedTransformationParameters,
    sharedErrorSchemaObject,
    sharedFileMetaExampleObject,
    sharedFileMetaSchemaObject,
    sharedGet,
    sharedGetList,
    sharedGetMeta,
} from "../../src/openapi/shared";

describe("openapi/shared", () => {
    describe("sharedGet", () => {
        it("should create GET operation without transform", () => {
            expect.assertions(3);

            const operation = sharedGet("getFile", ["Files"]);

            expect(operation.operationId).toBe("getFile");
            expect(operation.tags).toEqual(["Files"]);
            expect(operation.parameters).toHaveLength(1);
        });

        it("should create GET operation with image transform", () => {
            expect.assertions(2);

            const operation = sharedGet("getFile", ["Files"], "image");

            expect(operation.operationId).toBe("getFile");
            expect(operation.parameters?.length).toBeGreaterThan(1);
        });

        it("should create GET operation with video transform", () => {
            expect.assertions(2);

            const operation = sharedGet("getFile", ["Files"], "video");

            expect(operation.operationId).toBe("getFile");
            expect(operation.parameters?.length).toBeGreaterThan(1);
        });

        it("should create GET operation with audio transform", () => {
            expect.assertions(2);

            const operation = sharedGet("getFile", ["Files"], "audio");

            expect(operation.operationId).toBe("getFile");
            expect(operation.parameters?.length).toBeGreaterThan(1);
        });

        it("should create GET operation with custom transformer format", () => {
            expect.assertions(1);

            const operation = sharedGet("getFile", ["Files"], "image", ["jpeg", "png"]);

            expect(operation.parameters?.length).toBeGreaterThan(1);
        });

        it("should include transformation error responses when transform is enabled", () => {
            expect.assertions(1);

            const operation = sharedGet("getFile", ["Files"], "image");

            expect(operation.responses?.[400]).toBeDefined();
        });
    });

    describe("sharedGetMeta", () => {
        it("should create GET metadata operation", () => {
            expect.assertions(3);

            const operation = sharedGetMeta("getFileMeta", ["Files"]);

            expect(operation.operationId).toBe("getFileMeta");
            expect(operation.tags).toEqual(["Files"]);
            expect(operation.parameters).toHaveLength(1);
        });

        it("should include 404 response", () => {
            expect.assertions(1);

            const operation = sharedGetMeta("getFileMeta", ["Files"]);

            expect(operation.responses?.[404]).toBeDefined();
        });
    });

    describe("sharedGetList", () => {
        it("should create GET list operation", () => {
            expect.assertions(3);

            const operation = sharedGetList("listFiles", ["Files"]);

            expect(operation.operationId).toBe("listFiles");
            expect(operation.tags).toEqual(["Files"]);
            expect(operation.parameters).toBeDefined();
        });

        it("should include query parameters", () => {
            expect.assertions(1);

            const operation = sharedGetList("listFiles", ["Files"]);

            expect(operation.parameters?.some((p) => p.in === "query")).toBe(true);
        });
    });

    describe("sharedErrorSchemaObject", () => {
        it("should export error schema object", () => {
            expect.assertions(1);

            expect(sharedErrorSchemaObject).toBeDefined();
        });

        it("should include Error schema", () => {
            expect.assertions(1);

            expect(sharedErrorSchemaObject.Error).toBeDefined();
        });

        it("should include ValidationError schema", () => {
            expect.assertions(1);

            expect(sharedErrorSchemaObject.ValidationError).toBeDefined();
        });
    });

    describe("sharedFileMetaSchemaObject", () => {
        it("should export file meta schema object", () => {
            expect.assertions(1);

            expect(sharedFileMetaSchemaObject).toBeDefined();
        });

        it("should include FileMeta schema", () => {
            expect.assertions(1);

            expect(sharedFileMetaSchemaObject.FileMeta).toBeDefined();
        });
    });

    describe("sharedFileMetaExampleObject", () => {
        it("should export file meta example object", () => {
            expect.assertions(1);

            expect(sharedFileMetaExampleObject).toBeDefined();
        });

        it("should include FileMeta example", () => {
            expect.assertions(1);

            expect(sharedFileMetaExampleObject.FileMeta).toBeDefined();
        });
    });

    describe("getOrganizedTransformationParameters", () => {
        it("should return empty parameters when transform is false", () => {
            expect.assertions(2);

            const result = getOrganizedTransformationParameters(false);

            expect(result.parameters).toEqual([]);
            expect(result.groups).toEqual({});
        });

        it("should return empty parameters when transform is undefined", () => {
            expect.assertions(2);

            const result = getOrganizedTransformationParameters(undefined);

            expect(result.parameters).toEqual([]);
            expect(result.groups).toEqual({});
        });

        it("should return parameters for image transform", () => {
            expect.assertions(1);

            const result = getOrganizedTransformationParameters("image");

            expect(result.parameters.length).toBeGreaterThan(0);
        });

        it("should return parameters for video transform", () => {
            expect.assertions(1);

            const result = getOrganizedTransformationParameters("video");

            expect(result.parameters.length).toBeGreaterThan(0);
        });

        it("should return parameters for audio transform", () => {
            expect.assertions(1);

            const result = getOrganizedTransformationParameters("audio");

            expect(result.parameters.length).toBeGreaterThan(0);
        });

        it("should return parameters for boolean transform", () => {
            expect.assertions(1);

            const result = getOrganizedTransformationParameters(true);

            expect(result.parameters.length).toBeGreaterThan(0);
        });

        it("should use custom format array", () => {
            expect.assertions(1);

            const result = getOrganizedTransformationParameters("image", ["jpeg", "png"]);

            expect(result.parameters.length).toBeGreaterThan(0);
        });
    });
});

