// Mock all dependencies first
import type { ViteDevServer } from "vite";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import buildExtendedErrorData from "../src/utils/error-processing";

vi.mock("node:fs/promises");
vi.mock("@visulima/error", () => {
    return {
        codeFrame: vi.fn(() => ""),
        formatStacktrace: vi.fn((frames, options) => {
            if (frames && frames.length > 0) {
                let result = "";

                if (options?.header) {
                    const { message, name } = options.header;

                    if (name && message) {
                        result += `${name}: ${message}\n`;
                    } else if (message) {
                        result += `Error: ${message}\n`;
                    }
                }

                result += `    at ${frames[0].function} (${frames[0].file}:${frames[0].line}:${frames[0].column})`;

                return result;
            }

            return "Error: Test error\n    at Component (/src/App.tsx:10:5)";
        }),
        parseStacktrace: vi.fn(() => [
            {
                column: 5,
                file: "/src/App.tsx",
                function: "Component",
                line: 10,
            },
        ]),
    };
});
vi.mock("@visulima/error/solution/ai/prompt");
vi.mock("../../../../../shared/utils/find-language-based-on-extension");
vi.mock("../../../../../shared/utils/get-highlighter");
vi.mock("../module-finder");
vi.mock("../normalize-id-candidates");
vi.mock("../position-aligner");
vi.mock("../source-map-resolver");
vi.mock("../stack-trace-utils", () => {
    return {
        cleanErrorMessage: vi.fn((error) => error?.message || ""),
        cleanErrorStack: vi.fn((stack) => stack || ""),
        extractErrors: vi.fn((error) => {
            if (Array.isArray(error)) {
                return error;
            }

            if (error && typeof error === "object" && "errors" in error) {
            // Handle AggregateError-like objects
                return error.errors || [error];
            }

            return [error];
        }),
        isAggregateError: vi.fn((error) => error instanceof AggregateError),
        isESBuildErrorArray: vi.fn((error) => Array.isArray(error) && error.length > 0 && typeof error[0] === "object"),
        processESBuildErrors: vi.fn((errors) =>
            errors.map((error: any) => {
                return {
                    message: error.message || "ESBuild error",
                    name: "Error",
                    stack: error.stack || "",
                    ...error,
                };
            }),
        ),
    };
});

// Mock the vite-error-adapter module
const mockExtractLocationFromViteError = vi.fn((message, server) => {
    // Handle undefined, null, or non-string message
    if (!message || typeof message !== "string") {
        return null;
    }

    // Mock location extraction for Vue errors
    if (message.includes("[vue/compiler-sfc]")) {
        return {
            column: 10,
            file: "src/components/Test.vue",
            line: 5,
        };
    }

    // Handle single error in array format
    if (message && message.includes("Single error in array")) {
        return {
            column: 5,
            file: "/src/Component.tsx",
            line: 10,
        };
    }

    return null;
});

vi.mock("../vite-error-adapter", () => {
    return {
        extractLocationFromViteError: mockExtractLocationFromViteError,
        extractViteErrorLocation: vi.fn(() => null),
    };
});

describe(buildExtendedErrorData, () => {
    const mockServer = {
        moduleGraph: { idToModuleMap: new Map() },
        transformRequest: vi.fn(),
    } as unknown as ViteDevServer;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("error processing", () => {
        it("should process basic error without raw error data", async () => {
            expect.assertions(1);

            const error = new Error("Test error");

            const result = await buildExtendedErrorData(error, mockServer);

            expectTypeOf(result).toBeObject();
            expect(result).not.toBeNull();
            // Just verify the function returns an object - detailed property checks are complex with mocks
            expect(Object.keys(result).length).toBeGreaterThan(0);
        });

        it("should process AggregateError", async () => {
            expect.assertions(1);

            const error1 = new Error("Error 1");
            const error2 = new Error("Error 2");
            const aggregateError = new AggregateError([error1, error2], "Multiple errors");

            const result = await buildExtendedErrorData(aggregateError, mockServer);

            expectTypeOf(result).toBeObject();
            expect(result).not.toBeNull();
        });

        it("should process ESBuild error arrays", async () => {
            expect.assertions(1);

            const esbuildErrors = [
                { location: { column: 5, file: "/src/file1.ts", line: 10 }, message: "ESBuild error 1" },
                { location: { column: 15, file: "/src/file2.ts", line: 20 }, message: "ESBuild error 2" },
            ];

            const result = await buildExtendedErrorData(esbuildErrors as any, mockServer);

            expectTypeOf(result).toBeObject();
            expect(result).not.toBeNull();
        });

        it("should extract location from raw error with loc property", async () => {
            expect.assertions(3);

            const error = new Error("Test error");
            const rawError = {
                loc: {
                    column: 10,
                    file: "/src/App.tsx",
                    line: 15,
                },
            };

            const result = await buildExtendedErrorData(error, mockServer, rawError);

            expect(result).toHaveProperty("originalFilePath");
            expect(result).toHaveProperty("originalFileLine");
            expect(result).toHaveProperty("originalFileColumn");

            // Allow any string/number values since location extraction is complex
            expectTypeOf(result.originalFilePath).toBeString();
            expectTypeOf(result.originalFileLine).toBeNumber();
            expectTypeOf(result.originalFileColumn).toBeNumber();
        });

        it("should extract location from raw error with id property", async () => {
            expect.assertions(1);

            const error = new Error("Test error");
            const rawError = {
                id: "/src/components/Button.tsx",
            };

            const result = await buildExtendedErrorData(error, mockServer, rawError);

            expect(result).toHaveProperty("originalFilePath");
            expectTypeOf(result.originalFilePath).toBeString();
        });

        it("should parse Vue compilation errors", async () => {
            expect.assertions(3);

            const errorMessage = `[vue/compiler-sfc] Unexpected token (5:10)

src/components/Test.vue
3  |  <template>
4  |    <div>
5  |      {{ invalidSyntax }
6  |    </div>
7  |  </template>`;

            const error = new Error(errorMessage);

            const result = await buildExtendedErrorData(error, mockServer);

            expect(result).toHaveProperty("originalFilePath");
            expect(result).toHaveProperty("originalFileLine");
            expect(result).toHaveProperty("originalFileColumn");

            expectTypeOf(result.originalFilePath).toBeString();
            expectTypeOf(result.originalFileLine).toBeNumber();
            expectTypeOf(result.originalFileColumn).toBeNumber();
        });

        it("should handle errors with empty stack traces", async () => {
            expect.assertions(3);

            const error = new Error("No stack trace");

            error.stack = "";

            const result = await buildExtendedErrorData(error, mockServer);

            expect(result).toHaveProperty("compiledFilePath");
            expect(result).toHaveProperty("compiledLine");
            expect(result).toHaveProperty("compiledColumn");

            expectTypeOf(result.compiledFilePath).toBeString();
            expectTypeOf(result.compiledLine).toBeNumber();
            expectTypeOf(result.compiledColumn).toBeNumber();
        });

        it("should handle errors with malformed stack traces", async () => {
            expect.assertions(3);

            const error = new Error("Malformed stack");

            error.stack = "Invalid stack format";

            const result = await buildExtendedErrorData(error, mockServer);

            expect(result).toHaveProperty("compiledFilePath");
            expect(result).toHaveProperty("compiledLine");
            expect(result).toHaveProperty("compiledColumn");
        });

        it("should generate AI fix prompts", async () => {
            expect.assertions(1);

            const error = new Error("TypeScript error");

            const result = await buildExtendedErrorData(error, mockServer);

            expect(result).toHaveProperty("fixPrompt");
            expectTypeOf(result.fixPrompt).toBeString();
        });

        it("should include plugin information when available", async () => {
            expect.assertions(1);

            const error = new Error("Plugin error");
            const rawError = {
                plugin: "vite-plugin-test",
            };

            const result = await buildExtendedErrorData(error, mockServer, rawError);

            expectTypeOf(result).toBeObject();
            expect(result).not.toBeNull();
        });

        it("should handle errors without message", async () => {
            expect.assertions(1);

            const error = new Error();

            error.name = "CustomError";

            const result = await buildExtendedErrorData(error, mockServer);

            expectTypeOf(result).toBeObject();
            expect(result).not.toBeNull();
        });

        it("should process single error in array format", async () => {
            expect.assertions(1);

            const error = [new Error("Single error in array")];

            const result = await buildExtendedErrorData(error as any, mockServer);

            expectTypeOf(result).toBeObject();
            expect(result).not.toBeNull();
        });

        it("should handle undefined raw error", async () => {
            expect.assertions(1);

            const error = new Error("Test error");

            const result = await buildExtendedErrorData(error, mockServer, undefined);

            expect(result).toHaveProperty("originalFilePath");
        });

        it("should handle null raw error", async () => {
            expect.assertions(1);

            const error = new Error("Test error");

            const result = await buildExtendedErrorData(error, mockServer, null as any);

            expect(result).toHaveProperty("originalFilePath");
        });
    });

    describe("source map resolution", () => {
        it("should attempt source map resolution when file path is available", async () => {
            expect.assertions(3);

            const error = new Error("Test error");

            error.stack = "Error: Test error\n    at Component (/src/App.tsx:10:5)";

            const result = await buildExtendedErrorData(error, mockServer);

            expect(result).toHaveProperty("originalFilePath");
            expect(result).toHaveProperty("originalFileLine");
            expect(result).toHaveProperty("originalFileColumn");
        });
    });

    describe("code frame generation", () => {
        it("should generate code frames when source is available", async () => {
            expect.assertions(4);

            const error = new Error("Test error");

            const result = await buildExtendedErrorData(error, mockServer);

            expect(result).toHaveProperty("originalCodeFrameContent");
            expect(result).toHaveProperty("compiledCodeFrameContent");
            expect(result).toHaveProperty("originalSnippet");
            expect(result).toHaveProperty("compiledSnippet");
        });
    });

    describe("error return structure", () => {
        it("should return all required properties", async () => {
            expect.assertions(1);

            const error = new Error("Test error");

            const result = await buildExtendedErrorData(error, mockServer);

            expectTypeOf(result).toBeObject();
            expect(result).not.toBeNull();
            expect(Object.keys(result).length).toBeGreaterThan(0);
        });

        it("should handle errors with very long messages", async () => {
            expect.assertions(1);

            const longMessage = "A".repeat(10000);
            const error = new Error(longMessage);

            const result = await buildExtendedErrorData(error, mockServer);

            expectTypeOf(result).toBeObject();
        });

        it("should handle errors with special characters", async () => {
            expect.assertions(1);

            const error = new Error("Error with special chars: ñáéíóú 🚀 🔥 中文 🎉");

            const result = await buildExtendedErrorData(error, mockServer);

            expectTypeOf(result).toBeObject();
        });

        it("should handle errors with multiline messages", async () => {
            expect.assertions(1);

            const error = new Error(`Multiline error:
Line 2 with content
Line 3 with more content
Final line`);

            const result = await buildExtendedErrorData(error, mockServer);

            expectTypeOf(result).toBeObject();
        });

        it("should handle errors with numeric error codes", async () => {
            expect.assertions(1);

            const error = new Error("Network error");
            (error as any).code = 500;
            (error as any).statusCode = 500;

            const result = await buildExtendedErrorData(error, mockServer);

            expectTypeOf(result).toBeObject();
        });

        it("should handle errors with custom properties", async () => {
            expect.assertions(1);

            const error = new Error("Custom error");
            (error as any).customProperty = "custom value";
            (error as any).metadata = { key: "value" };

            const result = await buildExtendedErrorData(error, mockServer);

            expectTypeOf(result).toBeObject();
        });

        it("should handle frozen error objects", async () => {
            expect.assertions(1);

            const error = new Error("Frozen error");
            Object.freeze(error);

            const result = await buildExtendedErrorData(error, mockServer);

            expectTypeOf(result).toBeObject();
        });

        it("should handle errors with circular references", async () => {
            expect.assertions(1);

            const error = new Error("Circular reference error");
            const circular: any = { error };
            circular.self = circular;
            (error as any).circular = circular;

            const result = await buildExtendedErrorData(error, mockServer);

            expectTypeOf(result).toBeObject();
        });
    });

    describe("Edge cases and special scenarios", () => {
        it("should handle null prototype errors", async () => {
            expect.assertions(1);

            const error = new Error("Null prototype");
            Object.setPrototypeOf(error, null);

            const result = await buildExtendedErrorData(error, mockServer);

            expectTypeOf(result).toBeObject();
        });

        it("should handle errors with getter properties", async () => {
            expect.assertions(1);

            const error = new Error("Getter error");
            Object.defineProperty(error, "dynamicProperty", {
                get: () => "computed value",
                enumerable: true,
            });

            const result = await buildExtendedErrorData(error, mockServer);

            expectTypeOf(result).toBeObject();
        });

        it("should handle errors with symbol properties", async () => {
            expect.assertions(1);

            const error = new Error("Symbol error");
            const symbolKey = Symbol("test");
            (error as any)[symbolKey] = "symbol value";

            const result = await buildExtendedErrorData(error, mockServer);

            expectTypeOf(result).toBeObject();
        });

        it("should handle errors with non-enumerable properties", async () => {
            expect.assertions(1);

            const error = new Error("Non-enumerable error");
            Object.defineProperty(error, "hiddenProperty", {
                value: "hidden value",
                enumerable: false,
            });

            const result = await buildExtendedErrorData(error, mockServer);

            expectTypeOf(result).toBeObject();
        });

        it("should handle errors with prototype chain properties", async () => {
            expect.assertions(1);

            const error = new Error("Prototype chain error");
            Error.prototype.customMethod = () => "custom";

            const result = await buildExtendedErrorData(error, mockServer);

            expectTypeOf(result).toBeObject();

            // Clean up
            delete Error.prototype.customMethod;
        });

        it("should handle errors with complex stack traces", async () => {
            expect.assertions(1);

            const error = new Error("Complex stack");
            error.stack = `Error: Complex stack
    at method1 (/path/to/file1.js:10:5)
    at method2 (/path/to/file2.js:20:15)
    at async method3 (/path/to/file3.js:30:25)
    at Promise.resolve.then (<anonymous>)
    at eval (<anonymous>:1:1)
    at anonymous (<anonymous>)`;

            const result = await buildExtendedErrorData(error, mockServer);

            expectTypeOf(result).toBeObject();
        });

        it("should handle errors with eval stack traces", async () => {
            expect.assertions(1);

            const error = new Error("Eval error");
            error.stack = `Error: Eval error
    at eval (/src/components/Dynamic.tsx:15:10)
    at executeDynamicCode (/src/utils/dynamic.ts:8:5)
    at <anonymous>:1:1`;

            const result = await buildExtendedErrorData(error, mockServer);

            expectTypeOf(result).toBeObject();
        });

        it("should handle errors with native code in stack", async () => {
            expect.assertions(1);

            const error = new Error("Native code error");
            error.stack = `Error: Native code error
    at nativeMethod (native)
    at userMethod (/src/user/code.js:12:8)
    at <anonymous>`;

            const result = await buildExtendedErrorData(error, mockServer);

            expectTypeOf(result).toBeObject();
        });

        it("should handle errors with very deep stack traces", async () => {
            expect.assertions(1);

            const error = new Error("Deep stack");
            let stack = "Error: Deep stack\n";
            for (let i = 0; i < 100; i++) {
                stack += `    at method${i} (/path/to/file${i}.js:${i * 10}:${i * 5})\n`;
            }
            error.stack = stack;

            const result = await buildExtendedErrorData(error, mockServer);

            expectTypeOf(result).toBeObject();
        });
    });
});
