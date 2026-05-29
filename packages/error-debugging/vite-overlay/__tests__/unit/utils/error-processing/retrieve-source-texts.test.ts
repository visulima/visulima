/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/unbound-method */
import { readFile } from "node:fs/promises";

import type { ViteDevServer } from "vite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import retrieveSourceTexts from "../../../../src/utils/error-processing/retrieve-source-texts";

// Mock dependencies
vi.mock(import("node:fs/promises"));
vi.mock(import("../source-map-utils"));

describe(retrieveSourceTexts, () => {
    const mockServer = {
        transformRequest: vi.fn<() => Promise<unknown>>(),
    } as unknown as ViteDevServer;

    const mockReadFile = vi.mocked(readFile);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("source text retrieval", () => {
        it("should return empty sources when module has no relevant data", async () => {
            expect.assertions(1);

            const moduleItem = {};
            const filePath = "/src/App.tsx";
            const idCandidates = ["/src/App.tsx"];

            const result = await retrieveSourceTexts(mockServer, moduleItem, filePath, idCandidates);

            expect(result).toStrictEqual({
                compiledSourceText: undefined,
                originalSourceText: undefined,
            });
        });

        it("should handle modules with transform result", async () => {
            expect.assertions(1);

            const moduleItem = {
                transformResult: {
                    code: "compiled code",
                },
            };
            const filePath = "/src/App.tsx";
            const idCandidates = ["/src/App.tsx"];

            const result = await retrieveSourceTexts(mockServer, moduleItem, filePath, idCandidates);

            expect(result.compiledSourceText).toBe("compiled code");
        });

        it("should retrieve sources via transform request", async () => {
            expect.assertions(2);

            const moduleItem = {
                id: "/src/App.tsx",
            };
            const filePath = "/src/App.tsx";
            const idCandidates = ["/src/App.tsx"];

            const mockTransformed = {
                code: "compiled code",
            };

            mockServer.transformRequest.mockResolvedValue(mockTransformed);

            const result = await retrieveSourceTexts(mockServer, moduleItem, filePath, idCandidates);

            expect(mockServer.transformRequest).toHaveBeenCalledExactlyOnceWith("/src/App.tsx");
            expect(result.compiledSourceText).toBe("compiled code");
        });

        it("should use module URL when id is not available", async () => {
            expect.assertions(2);

            const moduleItem = {
                url: "/src/components/Button.tsx",
            };
            const filePath = "/src/components/Button.tsx";
            const idCandidates = ["/src/components/Button.tsx"];

            const mockTransformed = {
                code: "button compiled code",
            };

            mockServer.transformRequest.mockResolvedValue(mockTransformed);

            const result = await retrieveSourceTexts(mockServer, moduleItem, filePath, idCandidates);

            expect(mockServer.transformRequest).toHaveBeenCalledExactlyOnceWith("/src/components/Button.tsx");
            expect(result.compiledSourceText).toBe("button compiled code");
        });

        it("should use first id candidate as fallback", async () => {
            expect.assertions(2);

            const moduleItem = {};
            const filePath = "/src/utils/helpers.ts";
            const idCandidates = ["/src/utils/helpers.ts", "/src/utils/index.ts"];

            const mockTransformed = {
                code: "helpers compiled code",
            };

            mockServer.transformRequest.mockResolvedValue(mockTransformed);

            const result = await retrieveSourceTexts(mockServer, moduleItem, filePath, idCandidates);

            expect(mockServer.transformRequest).toHaveBeenCalledExactlyOnceWith("/src/utils/helpers.ts");
            expect(result.compiledSourceText).toBe("helpers compiled code");
        });

        it("should fallback to module transform result code", async () => {
            expect.assertions(1);

            const moduleItem = {
                transformResult: {
                    code: "transform result code",
                },
            };
            const filePath = "/src/App.tsx";
            const idCandidates = ["/src/App.tsx"];

            mockServer.transformRequest.mockResolvedValue({});

            const result = await retrieveSourceTexts(mockServer, moduleItem, filePath, idCandidates);

            expect(result.compiledSourceText).toBe("transform result code");
        });

        it("should fallback to reading original file directly", async () => {
            expect.assertions(2);

            const moduleItem = {
                file: "/home/project/src/App.tsx",
            };
            const filePath = "/src/App.tsx";
            const idCandidates = ["/src/App.tsx"];

            mockReadFile.mockResolvedValue("file content from disk");

            const result = await retrieveSourceTexts(mockServer, moduleItem, filePath, idCandidates);

            expect(mockReadFile).toHaveBeenCalledExactlyOnceWith("/home/project/src/App.tsx", "utf8");
            expect(result.originalSourceText).toBe("file content from disk");
        });

        it("should handle transform request errors gracefully", async () => {
            expect.assertions(1);

            const moduleItem = {
                id: "/src/App.tsx",
            };
            const filePath = "/src/App.tsx";
            const idCandidates = ["/src/App.tsx"];

            mockServer.transformRequest.mockRejectedValue(new Error("Transform failed"));

            const result = await retrieveSourceTexts(mockServer, moduleItem, filePath, idCandidates);

            expect(result).toStrictEqual({
                compiledSourceText: undefined,
                originalSourceText: undefined,
            });
        });

        it("should handle file read errors gracefully", async () => {
            expect.assertions(1);

            const moduleItem = {
                file: "/nonexistent/file.tsx",
            };
            const filePath = "/src/App.tsx";
            const idCandidates = ["/src/App.tsx"];

            mockReadFile.mockRejectedValue(new Error("File not found"));

            const result = await retrieveSourceTexts(mockServer, moduleItem, filePath, idCandidates);

            expect(result.originalSourceText).toBeUndefined();
        });

        it("extracts original source from a cached transform-result source map", async () => {
            expect.assertions(2);

            const moduleItem = {
                transformResult: {
                    code: "compiled code",
                    map: {
                        mappings: "AAAA",
                        sources: ["/src/App.tsx"],
                        sourcesContent: ["original source from cached map"],
                    },
                },
            };
            const filePath = "/src/App.tsx";
            const idCandidates = ["/src/App.tsx"];

            const result = await retrieveSourceTexts(mockServer, moduleItem, filePath, idCandidates);

            expect(result.compiledSourceText).toBe("compiled code");
            expect(result.originalSourceText).toBe("original source from cached map");
        });

        it("extracts original source from a transform-request source map with mappings", async () => {
            expect.assertions(2);

            const moduleItem = {
                id: "/src/Widget.tsx",
            };
            const filePath = "/src/Widget.tsx";
            const idCandidates = ["/src/Widget.tsx"];

            mockServer.transformRequest.mockResolvedValue({
                code: "widget compiled",
                map: {
                    mappings: "AAAA",
                    sources: ["/src/Widget.tsx"],
                    sourcesContent: ["widget original source"],
                },
            });

            const result = await retrieveSourceTexts(mockServer, moduleItem, filePath, idCandidates);

            expect(result.compiledSourceText).toBe("widget compiled");
            expect(result.originalSourceText).toBe("widget original source");
        });

        it("ignores a transform-request source map with empty mappings", async () => {
            expect.assertions(2);

            const moduleItem = {
                id: "/src/Empty.tsx",
            };
            const filePath = "/src/Empty.tsx";
            const idCandidates = ["/src/Empty.tsx"];

            mockServer.transformRequest.mockResolvedValue({
                code: "empty compiled",
                map: {
                    mappings: "",
                    sources: ["/src/Empty.tsx"],
                    sourcesContent: ["should be ignored"],
                },
            });

            const result = await retrieveSourceTexts(mockServer, moduleItem, filePath, idCandidates);

            expect(result.compiledSourceText).toBe("empty compiled");
            expect(result.originalSourceText).toBeUndefined();
        });

        it("should prioritize transform result over other sources", async () => {
            expect.assertions(1);

            const moduleItem = {
                id: "/src/App.tsx",
                transformResult: {
                    code: "transform compiled code",
                },
            };
            const filePath = "/src/App.tsx";
            const idCandidates = ["/src/App.tsx"];

            const mockTransformed = {
                code: "new compiled code",
            };

            mockServer.transformRequest.mockResolvedValue(mockTransformed);

            const result = await retrieveSourceTexts(mockServer, moduleItem, filePath, idCandidates);

            // Implementation prioritizes cached transform result for performance
            expect(result.compiledSourceText).toBe("transform compiled code");
        });
    });
});
