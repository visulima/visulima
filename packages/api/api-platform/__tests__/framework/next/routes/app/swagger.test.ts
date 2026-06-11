import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { OpenAPIV3 } from "openapi-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import swaggerRouteHandler from "../../../../../src/framework/next/routes/app/swagger";

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

describe("framework/next/routes/app/swagger", () => {
    let temporaryDirectory: string;

    beforeEach(() => {
        temporaryDirectory = mkdtempSync(join(tmpdir(), "api-platform-app-swagger-"));
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

    it("should return a JSON Response with the assembled spec", async () => {
        expect.assertions(3);

        writeSwaggerFile(baseSpec);

        const response = await swaggerRouteHandler()(new Request("http://localhost/api/docs"));

        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("application/json");

        const data = (await response.json()) as OpenAPIV3.Document;

        expect(data.info.title).toBe("Test");
    });

    it("should return YAML when the accept header requests it", async () => {
        expect.assertions(2);

        writeSwaggerFile(baseSpec);

        const response = await swaggerRouteHandler()(
            new Request("http://localhost/api/docs", { headers: { accept: "application/x-yaml" } }),
        );

        expect(response.headers.get("Content-Type")).toBe("application/x-yaml");
        await expect(response.text()).resolves.toContain("openapi:");
    });

    it("should respond with 304 when If-None-Match matches the ETag", async () => {
        expect.assertions(2);

        writeSwaggerFile(baseSpec);

        const handler = swaggerRouteHandler();

        const first = await handler(new Request("http://localhost/api/docs"));
        const etag = first.headers.get("ETag");

        expect(etag).toStrictEqual(expect.any(String));

        const second = await handler(
            new Request("http://localhost/api/docs", { headers: { "if-none-match": etag as string } }),
        );

        expect(second.status).toBe(304);
    });

    it("should throw when the swagger file does not exist", async () => {
        expect.assertions(1);

        await expect(swaggerRouteHandler()(new Request("http://localhost/api/docs"))).rejects.toThrow("Swagger file not found");
    });
});
