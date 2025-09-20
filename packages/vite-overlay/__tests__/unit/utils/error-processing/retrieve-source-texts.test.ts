import { readFile } from "node:fs/promises";

import type { ViteDevServer } from "vite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import retrieveSourceTexts from "../../../../src/utils/error-processing/retrieve-source-texts";

// Mock dependencies
vi.mock("node:fs/promises");
vi.mock("../source-map-utils");

describe(retrieveSourceTexts, () => {
    const mockServer = {
        transformRequest: vi.fn(),
    } as unknown as ViteDevServer;

    const mockReadFile = vi.mocked(readFile);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("source text retrieval", () => {
        it("should return empty sources when module has no relevant data", async () => {
            expect.assertions(1);

            const module_ = {};
            const filePath = "/src/App.tsx";
            const idCandidates = ["/src/App.tsx"];

            const result = await retrieveSourceTexts(mockServer, module_, filePath, idCandidates);

            expect(result).toEqual({
                compiledSourceText: undefined,
                originalSourceText: undefined,
            });
        });

        it("should handle modules with transform result", async () => {
            expect.assertions(1);

            const module_ = {
                transformResult: {
                    code: "compiled code",
                },
            };
            const filePath = "/src/App.tsx";
            const idCandidates = ["/src/App.tsx"];

            const result = await retrieveSourceTexts(mockServer, module_, filePath, idCandidates);

            expect(result.compiledSourceText).toBe("compiled code");
        });

        it("should retrieve sources via transform request", async () => {
            expect.assertions(2);

            const module_ = {
                id: "/src/App.tsx",
            };
            const filePath = "/src/App.tsx";
            const idCandidates = ["/src/App.tsx"];

            const mockTransformed = {
                code: "compiled code",
            };

            mockServer.transformRequest.mockResolvedValue(mockTransformed);

            const result = await retrieveSourceTexts(mockServer, module_, filePath, idCandidates);

            expect(mockServer.transformRequest).toHaveBeenCalledWith("/src/App.tsx");
            expect(result.compiledSourceText).toBe("compiled code");
        });

        it("should use module URL when id is not available", async () => {
            expect.assertions(2);

            const module_ = {
                url: "/src/components/Button.tsx",
            };
            const filePath = "/src/components/Button.tsx";
            const idCandidates = ["/src/components/Button.tsx"];

            const mockTransformed = {
                code: "button compiled code",
            };

            mockServer.transformRequest.mockResolvedValue(mockTransformed);

            const result = await retrieveSourceTexts(mockServer, module_, filePath, idCandidates);

            expect(mockServer.transformRequest).toHaveBeenCalledWith("/src/components/Button.tsx");
            expect(result.compiledSourceText).toBe("button compiled code");
        });

        it("should use first id candidate as fallback", async () => {
            expect.assertions(2);

            const module_ = {};
            const filePath = "/src/utils/helpers.ts";
            const idCandidates = ["/src/utils/helpers.ts", "/src/utils/index.ts"];

            const mockTransformed = {
                code: "helpers compiled code",
            };

            mockServer.transformRequest.mockResolvedValue(mockTransformed);

            const result = await retrieveSourceTexts(mockServer, module_, filePath, idCandidates);

            expect(mockServer.transformRequest).toHaveBeenCalledWith("/src/utils/helpers.ts");
            expect(result.compiledSourceText).toBe("helpers compiled code");
        });

        it("should fallback to module transform result code", async () => {
            expect.assertions(1);

            const module_ = {
                transformResult: {
                    code: "transform result code",
                },
            };
            const filePath = "/src/App.tsx";
            const idCandidates = ["/src/App.tsx"];

            mockServer.transformRequest.mockResolvedValue({});

            const result = await retrieveSourceTexts(mockServer, module_, filePath, idCandidates);

            expect(result.compiledSourceText).toBe("transform result code");
        });

        it("should fallback to reading original file directly", async () => {
            expect.assertions(2);

            const module_ = {
                file: "/home/project/src/App.tsx",
            };
            const filePath = "/src/App.tsx";
            const idCandidates = ["/src/App.tsx"];

            mockReadFile.mockResolvedValue("file content from disk");

            const result = await retrieveSourceTexts(mockServer, module_, filePath, idCandidates);

            expect(mockReadFile).toHaveBeenCalledWith("/home/project/src/App.tsx", "utf8");
            expect(result.originalSourceText).toBe("file content from disk");
        });

        it("should handle transform request errors gracefully", async () => {
            expect.assertions(1);

            const module_ = {
                id: "/src/App.tsx",
            };
            const filePath = "/src/App.tsx";
            const idCandidates = ["/src/App.tsx"];

            mockServer.transformRequest.mockRejectedValue(new Error("Transform failed"));

            const result = await retrieveSourceTexts(mockServer, module_, filePath, idCandidates);

            expect(result).toEqual({
                compiledSourceText: undefined,
                originalSourceText: undefined,
            });
        });

        it("should handle file read errors gracefully", async () => {
            expect.assertions(1);

            const module_ = {
                file: "/nonexistent/file.tsx",
            };
            const filePath = "/src/App.tsx";
            const idCandidates = ["/src/App.tsx"];

            mockReadFile.mockRejectedValue(new Error("File not found"));

            const result = await retrieveSourceTexts(mockServer, module_, filePath, idCandidates);

            expect(result.originalSourceText).toBeUndefined();
        });

        it("should prioritize transform result over other sources", async () => {
            expect.assertions(1);

            const module_ = {
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

            const result = await retrieveSourceTexts(mockServer, module_, filePath, idCandidates);

            // Implementation prioritizes cached transform result for performance
            expect(result.compiledSourceText).toBe("transform compiled code");
        });
    });
});
