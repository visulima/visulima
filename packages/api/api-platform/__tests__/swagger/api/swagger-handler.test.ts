import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createMocks } from "node-mocks-http";
import type { OpenAPIV3 } from "openapi-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import swaggerHandler from "../../../src/swagger/api/swagger-handler";

const baseSpec: OpenAPIV3.Document = {
    info: { title: "Test", version: "1.0.0" },
    openapi: "3.0.0",
    paths: {
        "/test": {
            get: {
                responses: {
                    200: {
                        content: {
                            "application/json": {
                                schema: { type: "object" },
                            },
                        },
                        description: "OK",
                    },
                },
            },
        },
    },
};

describe("swagger/api/swagger-handler", () => {
    let temporaryDirectory: string;

    beforeEach(() => {
        temporaryDirectory = mkdtempSync(join(tmpdir(), "api-platform-swagger-"));
        vi.spyOn(process, "cwd").mockReturnValue(temporaryDirectory);
    });

    afterEach(() => {
        rmSync(temporaryDirectory, { force: true, recursive: true });
        vi.restoreAllMocks();
    });

    const writeSwaggerFile = (spec: OpenAPIV3.Document, relativePath = "swagger/swagger.json"): void => {
        const fullPath = join(temporaryDirectory, relativePath);

        mkdirSync(join(fullPath, ".."), { recursive: true });
        writeFileSync(fullPath, JSON.stringify(spec), "utf8");
    };

    it("should throw when the swagger file does not exist", async () => {
        expect.assertions(1);

        const { req, res } = createMocks({ method: "GET" });

        await expect(swaggerHandler()(req, res)).rejects.toThrow("Swagger file not found");
    });

    it("should respond with the extended spec as json by default", async () => {
        expect.assertions(3);

        writeSwaggerFile(baseSpec);

        const { req, res } = createMocks({ method: "GET" });

        await swaggerHandler()(req, res);

        expect(res.getHeader("Content-Type")).toBe("application/json");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(200);

        // eslint-disable-next-line no-underscore-dangle
        const data = JSON.parse(res._getData() as string) as OpenAPIV3.Document;

        expect(data.info.title).toBe("Test");
    });

    it("should respond with yaml when the accept header requests it", async () => {
        expect.assertions(2);

        writeSwaggerFile(baseSpec);

        const { req, res } = createMocks({
            headers: { accept: "application/x-yaml" },
            method: "GET",
        });

        await swaggerHandler()(req, res);

        expect(res.getHeader("Content-Type")).toBe("application/x-yaml");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toContain("openapi:");
    });

    it("should read from a custom swaggerFilePath", async () => {
        expect.assertions(1);

        writeSwaggerFile(baseSpec, "docs/openapi.json");

        const { req, res } = createMocks({ method: "GET" });

        await swaggerHandler({ swaggerFilePath: "docs/openapi.json" })(req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(200);
    });

    it("should merge additional specs passed via the specs option", async () => {
        expect.assertions(1);

        writeSwaggerFile(baseSpec);

        const extraSpec: Partial<OpenAPIV3.Document> = {
            paths: {
                "/extra": {
                    get: {
                        responses: {
                            200: {
                                content: { "application/json": { schema: { type: "object" } } },
                                description: "OK",
                            },
                        },
                    },
                },
            },
        };

        const { req, res } = createMocks({ method: "GET" });

        await swaggerHandler({ specs: [extraSpec] })(req, res);

        // eslint-disable-next-line no-underscore-dangle
        const data = JSON.parse(res._getData() as string) as OpenAPIV3.Document;

        expect(data.paths["/extra"]).toBeDefined();
    });

    it("should wrap crud generation errors with a helpful message", async () => {
        expect.assertions(1);

        writeSwaggerFile(baseSpec);

        vi.spyOn(console, "log").mockImplementation(() => {});

        const { req, res } = createMocks({ method: "GET" });

        await expect(
            // empty crud config makes @visulima/crud throw, exercising the catch branch
            swaggerHandler({ crud: {} as never })(req, res),
        ).rejects.toThrow("Please install @visulima/crud to use the crud swagger generator.");
    });
});
