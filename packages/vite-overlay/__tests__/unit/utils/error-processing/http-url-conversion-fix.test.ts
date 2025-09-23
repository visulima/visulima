/**
 * Integration test demonstrating the HTTP URL conversion fix
 * This test verifies that both primary and cause errors resolve to the same module
 * when they should have consistent compiled code frames.
 */

import { parseStacktrace } from "@visulima/error";
import { describe, expect, it, vi } from "vitest";

import buildExtendedErrorData from "../../../../src/utils/error-processing";

vi.mock("@visulima/error", () => {
    return {
        codeFrame: vi.fn(() => ""),
        formatStacktrace: vi.fn(() => ""),
        parseStacktrace: vi.fn(() => []),
    };
});

describe("hTTP URL Conversion Fix - Integration Test", () => {
    it("should ensure both primary and cause errors use consistent HTTP URLs for module resolution", async () => {
        expect.assertions(3);

        // Mock server with proper configuration
        const mockServer = {
            config: {
                root: "/home/user/project",
            },
            moduleGraph: {
                getModuleById: vi.fn(),
                idToModuleMap: new Map(),
            },
            transformRequest: vi.fn(),
        } as any;

        // Mock module with the correct HTTP URL (including query parameter)
        const mockModule = {
            id: "http://localhost:5173/src/App.tsx?tsr-split=component",
            transformResult: {
                code: "console.log(\"compiled with query param\");",
                map: {
                    mappings: "AAAA",
                    sources: ["src/App.tsx"],
                    sourcesContent: ["console.log(\"original source\");"],
                    version: 3,
                },
            },
        };

        mockServer.moduleGraph.getModuleById.mockReturnValue(mockModule);
        mockServer.moduleGraph.idToModuleMap.set("http://localhost:5173/src/App.tsx?tsr-split=component", mockModule);

        // Mock stack trace parsing to simulate the scenario
        vi.mocked(parseStacktrace).mockImplementation((error: any) => {
            if (error.stack?.includes("cause")) {
                // Cause error has HTTP URL with query parameter
                return [
                    {
                        column: 12,
                        file: "http://localhost:5173/src/App.tsx?tsr-split=component",
                        function: "App",
                        line: 21,
                    },
                ];
            }

            // Primary error has local path
            return [
                {
                    column: 9,
                    file: "/home/user/project/src/App.tsx",
                    function: "App",
                    line: 20,
                },
            ];
        });

        // Create test errors
        const primaryError = new Error("Primary error");

        primaryError.stack = "Error: Primary error\n    at App (/home/user/project/src/App.tsx:20:9)";

        const causeError = new Error("Cause error");

        causeError.stack = "Error: Cause error\n    at App (http://localhost:5173/src/App.tsx?tsr-split=component:21:12)";

        const allErrors = [primaryError, causeError];

        // Mock parseStacktrace to handle both direct error objects and {stack: string} objects
        vi.mocked(parseStacktrace).mockImplementation((error: any, options?: any) => {
            const stack = error.stack || "";

            if (stack.includes("http://localhost:5173/src/App.tsx?tsr-split=component")) {
                return [
                    {
                        column: 12,
                        file: "http://localhost:5173/src/App.tsx?tsr-split=component",
                        function: "App",
                        line: 21,
                    },
                ];
            }

            return [
                {
                    column: 9,
                    file: "/home/user/project/src/App.tsx",
                    function: "App",
                    line: 20,
                },
            ];
        });

        // Process the primary error
        const result = await buildExtendedErrorData(primaryError, mockServer, 0, undefined, undefined, allErrors);

        // Verify the fix: both errors should resolve to the same HTTP URL with query parameter
        expect(result.compiledFilePath).toBe("http://localhost:5173/src/App.tsx?tsr-split=component");

        // Verify the error location information is preserved
        expect(result.compiledLine).toBe(20);
        expect(result.compiledColumn).toBe(9);
    });

    it("should handle cases where no cause errors have HTTP URLs", async () => {
        expect.assertions(1);

        const mockServer = {
            config: {
                root: "/home/user/project",
            },
            moduleGraph: {
                getModuleById: vi.fn(),
                idToModuleMap: new Map(),
            },
            transformRequest: vi.fn(),
        } as any;

        // Mock stack trace parsing - no HTTP URLs in cause errors
        vi.mocked(parseStacktrace).mockReturnValue([
            {
                column: 9,
                file: "/home/user/project/src/App.tsx",
                function: "App",
                line: 20,
            },
        ]);

        const primaryError = new Error("Primary error");

        primaryError.stack = "Error: Primary error\n    at App (/home/user/project/src/App.tsx:20:9)";

        const allErrors = [primaryError];

        const result = await buildExtendedErrorData(primaryError, mockServer, 0, undefined, undefined, allErrors);

        // Should convert to HTTP URL without query parameter
        expect(result.compiledFilePath).toBe("http://localhost:5173/src/App.tsx");
    });

    it("should gracefully handle malformed URLs in cause errors", async () => {
        expect.assertions(1);

        const mockServer = {
            config: {
                root: "/home/user/project",
            },
            moduleGraph: {
                getModuleById: vi.fn(),
                idToModuleMap: new Map(),
            },
            transformRequest: vi.fn(),
        } as any;

        // Mock stack trace parsing with malformed HTTP URL
        vi.mocked(parseStacktrace).mockImplementation((error: any, options?: any) => {
            const stack = error.stack || "";

            if (stack.includes("not-a-valid-http-url")) {
                return [
                    {
                        column: 12,
                        file: "not-a-valid-http-url",
                        function: "App",
                        line: 21,
                    },
                ];
            }

            return [
                {
                    column: 9,
                    file: "/home/user/project/src/App.tsx",
                    function: "App",
                    line: 20,
                },
            ];
        });

        const primaryError = new Error("Primary error");

        primaryError.stack = "Error: Primary error\n    at App (/home/user/project/src/App.tsx:20:9)";

        const causeError = new Error("Cause error");

        causeError.stack = "Error: Cause error\n    at App (not-a-valid-http-url:21:12)";

        const allErrors = [primaryError, causeError];

        const result = await buildExtendedErrorData(primaryError, mockServer, 0, undefined, undefined, allErrors);

        // Should still convert to valid HTTP URL despite malformed cause error
        expect(result.compiledFilePath).toBe("http://localhost:5173/src/App.tsx");
    });
});
