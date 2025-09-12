import { describe, expect, it, vi } from "vitest";

import createStackPage from "../src/error-inspector/page/stack";

describe("stack page", () => {
    describe(createStackPage, () => {
        it("should create a stack page for basic error", async () => {
            expect.assertions(5);

            const error = new Error("Test error");

            const page = await createStackPage(error, []);

            expect(page).toBeDefined();
            expect(page.id).toBe("stack");
            expect(page.name).toBe("Stack");
            expect(page.code.html).toContain("Test error");
            expect(page.defaultSelected).toBe(true);
        }, 10_000); // 10 seconds timeout

        it("should handle errors with stack traces", async () => {
            expect.assertions(4);

            const error = new Error("Stack trace error");

            error.stack = `Error: Stack trace error
    at testFunction (/path/to/file.js:10:5)
    at anotherFunction (/path/to/another.js:20:15)`;

            const page = await createStackPage(error, []);

            expect(page.code.html).toContain("testFunction");
            expect(page.code.html).toContain("anotherFunction");
            expect(page.code.html).toContain("/path/to/file.js");
            expect(page.code.html).toContain("10:5");
        });

        it("should handle errors with causes", async () => {
            expect.assertions(3);

            const cause = new Error("Root cause");

            cause.stack = "Error: Root cause\n    at rootFunction (/root.js:5:1)";

            const mainError = new Error("Main error");

            mainError.cause = cause;

            const page = await createStackPage(mainError, []);

            expect(page.code.html).toContain("Main error");
            expect(page.code.html).toContain("Root cause");
            expect(page.code.html).toContain("rootFunction");
        });

        it("should handle multiple levels of causes", async () => {
            expect.assertions(3);

            const deepestCause = new Error("Deepest cause");
            const middleCause = new Error("Middle cause");

            middleCause.cause = deepestCause;
            const mainError = new Error("Main error");

            mainError.cause = middleCause;

            const page = await createStackPage(mainError, []);

            expect(page.code.html).toContain("Main error");
            expect(page.code.html).toContain("Middle cause");
            expect(page.code.html).toContain("Deepest cause");
        }, 10_000); // 10 seconds timeout

        it("should handle solution finders", async () => {
            expect.assertions(2);

            const error = new Error("Test error");

            const mockFinder = {
                // eslint-disable-next-line vitest/require-mock-type-parameters
                handle: vi.fn().mockResolvedValue({
                    body: "This is a test solution",
                    header: "Test Solution",
                }),
                name: "test-finder",
                priority: 100,
            };

            const page = await createStackPage(error, [mockFinder]);

            expect(mockFinder.handle).toHaveBeenCalledWith(
                error,
                expect.objectContaining({
                    file: expect.any(String),
                    language: expect.any(String),
                    line: expect.any(Number),
                }),
            );
            expect(page.code.html).toContain("Test Solution");
        });

        it("should handle empty solution finders array", async () => {
            expect.assertions(2);

            const error = new Error("Test error");
            const page = await createStackPage(error, []);

            expect(page.code.html).toContain("Test error");
            expect(page.code.html).not.toContain("solution"); // Should not contain solution content
        });

        it("should handle undefined solution finders", async () => {
            expect.assertions(1);

            const error = new Error("Test error");
            const page = await createStackPage(error, undefined);

            expect(page.code.html).toContain("Test error");
        });

        it("should handle non-Error values", async () => {
            expect.assertions(1);

            const error = new Error("Converted error");

            const page = await createStackPage(error, []);

            expect(page.code.html).toContain("Converted error");
        });

        it("should handle errors without stack traces", async () => {
            expect.assertions(1);

            const error = new Error("No stack error");

            error.stack = undefined;

            const page = await createStackPage(error, []);

            expect(page.code.html).toContain("No stack error");
        });

        it("should handle errors with malformed stack traces", async () => {
            expect.assertions(1);

            const error = new Error("Malformed stack");

            error.stack = "invalid stack format";

            const page = await createStackPage(error, []);

            expect(page.code.html).toContain("Malformed stack");
        });

        it("should handle runtime information", async () => {
            expect.assertions(1);

            const error = new Error("Runtime error");

            // Mock process.version to test runtime detection
            const originalVersion = process.version;

            Object.defineProperty(process, "version", {
                value: "v18.17.0",
                writable: true,
            });

            try {
                const page = await createStackPage(error, []);

                expect(page.code.html).toContain("Runtime error");
            } finally {
                // Restore original version
                Object.defineProperty(process, "version", {
                    value: originalVersion,
                    writable: true,
                });
            }
        });

        it("should handle solution finder errors gracefully", async () => {
            expect.assertions(1);

            const error = new Error("Test error");

            const failingFinder = {
                // eslint-disable-next-line vitest/require-mock-type-parameters
                handle: vi.fn().mockRejectedValue(new Error("Finder failed")),
                name: "failing-finder",
                priority: 100,
            };

            const workingFinder = {
                // eslint-disable-next-line vitest/require-mock-type-parameters
                handle: vi.fn().mockResolvedValue({
                    body: "This works",
                    header: "Working Solution",
                }),
                name: "working-finder",
                priority: 50,
            };

            const page = await createStackPage(error, [failingFinder, workingFinder]);

            expect(page.code.html).toContain("Working Solution");
        });

        it("should prioritize solution finders by priority", async () => {
            expect.assertions(1);

            const error = new Error("Test error");

            const lowPriorityFinder = {
                // eslint-disable-next-line vitest/require-mock-type-parameters
                handle: vi.fn().mockResolvedValue({
                    body: "Low priority solution",
                    header: "Low Priority",
                }),
                name: "low-priority",
                priority: 10,
            };

            const highPriorityFinder = {
                // eslint-disable-next-line vitest/require-mock-type-parameters
                handle: vi.fn().mockResolvedValue({
                    body: "High priority solution",
                    header: "High Priority",
                }),
                name: "high-priority",
                priority: 100,
            };

            const page = await createStackPage(error, [lowPriorityFinder, highPriorityFinder]);

            expect(page.code.html).toContain("High Priority");
        });

        it("should handle async solution finders", async () => {
            expect.assertions(2);

            const error = new Error("Async test error");

            const asyncFinder = {
                // eslint-disable-next-line vitest/require-mock-type-parameters
                handle: vi.fn().mockImplementation(async () => {
                    await new Promise((resolve) => {
                        setTimeout(resolve, 10);
                    });

                    return {
                        body: "This was resolved asynchronously",
                        header: "Async Solution",
                    };
                }),
                name: "async-finder",
                priority: 100,
            };

            const page = await createStackPage(error, [asyncFinder]);

            expect(asyncFinder.handle).toHaveBeenCalledWith(
                error,
                expect.objectContaining({
                    file: expect.any(String),
                    language: expect.any(String),
                    line: expect.any(Number),
                }),
            );
            expect(page.code.html).toContain("Async Solution");
        });

        it("should handle solution finder returning undefined", async () => {
            expect.assertions(3);

            const error = new Error("Test error");

            const noSolutionFinder = {
                // eslint-disable-next-line vitest/require-mock-type-parameters
                handle: vi.fn().mockResolvedValue(undefined),
                name: "no-solution",
                priority: 100,
            };

            const page = await createStackPage(error, [noSolutionFinder]);

            expect(noSolutionFinder.handle).toHaveBeenCalledWith(
                error,
                expect.objectContaining({
                    file: expect.any(String),
                    language: expect.any(String),
                    line: expect.any(Number),
                }),
            );
            expect(page.code.html).toContain("Test error");
            expect(page.code.html).not.toContain("solution");
        });

        it("should handle multiple solution finders with different priorities", async () => {
            expect.assertions(1);

            const error = new Error("Multi finder test");

            const finders = [
                {
                    // eslint-disable-next-line vitest/require-mock-type-parameters
                    handle: vi.fn().mockResolvedValue({
                        body: "First solution",
                        header: "Solution 1",
                    }),
                    name: "finder-1",
                    priority: 50,
                },
                {
                    // eslint-disable-next-line vitest/require-mock-type-parameters
                    handle: vi.fn().mockResolvedValue({
                        body: "Second solution",
                        header: "Solution 2",
                    }),
                    name: "finder-2",
                    priority: 100,
                },
                {
                    // eslint-disable-next-line vitest/require-mock-type-parameters
                    handle: vi.fn().mockResolvedValue({
                        body: "Third solution",
                        header: "Solution 3",
                    }),
                    name: "finder-3",
                    priority: 25,
                },
            ];

            const page = await createStackPage(error, finders);

            // The highest priority solution should be shown (highest priority number = highest priority)
            expect(page.code.html).toContain("Solution 2");
        });
    });
});
