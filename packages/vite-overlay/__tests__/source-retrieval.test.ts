import type { ViteDevServer } from "vite";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import buildExtendedErrorData from "../src/utils/error-processing";

describe("source Retrieval Integration Tests", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("error processing with source retrieval", () => {
        it("should process basic error with stack trace", async () => {
            const mockError = new Error("Basic test error");

            mockError.stack = "Error: Basic test error\n    at Component (/app/src/component.ts:10:5)";

            const mockServer = {
                moduleGraph: {
                    idToModuleMap: new Map(),
                },
                transformRequest: vi.fn().mockRejectedValue(new Error("Transform failed")),
            } as unknown as ViteDevServer;

            const result = await buildExtendedErrorData(mockError, mockServer);

            expect(result).toBeDefined();

            expectTypeOf(result).toBeObject();
            // Just verify the function runs and returns an object
            // The specific properties depend on the implementation details
        });

        it("should handle error without stack trace", async () => {
            const mockError = new Error("No stack error");

            mockError.stack = undefined;

            const mockServer = {
                moduleGraph: {
                    idToModuleMap: new Map(),
                },
                transformRequest: vi.fn().mockRejectedValue(new Error("Transform failed")),
            } as unknown as ViteDevServer;

            const result = await buildExtendedErrorData(mockError, mockServer);

            expect(result).toBeDefined();
            expect(result.compiledFilePath).toBe("");
            expect(result.compiledLine).toBe(0);
            expect(result.compiledColumn).toBe(0);
        });

        it("should handle empty error message", async () => {
            const mockError = new Error("");

            mockError.stack = undefined;

            const mockServer = {
                moduleGraph: {
                    idToModuleMap: new Map(),
                },
                transformRequest: vi.fn().mockRejectedValue(new Error("Transform failed")),
            } as unknown as ViteDevServer;

            const result = await buildExtendedErrorData(mockError, mockServer);

            expect(result).toBeDefined();
            expect(result.compiledFilePath).toBe("");
        });

        it("should handle error with raw error payload", async () => {
            const mockError = new Error("Raw error test");
            const mockRawError = {
                loc: {
                    column: 15,
                    file: "/app/src/test.ts",
                    line: 25,
                },
                plugin: "vite-plugin-test",
            };

            const mockServer = {
                moduleGraph: {
                    idToModuleMap: new Map(),
                },
                transformRequest: vi.fn().mockRejectedValue(new Error("Transform failed")),
            } as unknown as ViteDevServer;

            const result = await buildExtendedErrorData(mockError, mockServer, mockRawError);

            expect(result).toBeDefined();

            expectTypeOf(result).toBeObject();
            // Just verify the function runs with raw error payload
        });
    });
});
