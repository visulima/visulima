import { describe, expect, it, vi } from "vitest";

import createStackPage from "../src/error-inspector/page/stack";

describe("stack page", () => {
    describe("createStackPage", () => {
        it("should create a stack page for basic error", async () => {
            const error = new Error("Test error");
            const solutionFinders = [];

            const page = await createStackPage(error, solutionFinders);

            expect(page).toBeDefined();
            expect(page.id).toBe("stack");
            expect(page.name).toBe("Stack");
            expect(page.code.html).toContain("Test error");
            expect(page.defaultSelected).toBe(true);
        });

        it("should handle errors with stack traces", async () => {
            const error = new Error("Stack trace error");
            error.stack = `Error: Stack trace error
    at testFunction (/path/to/file.js:10:5)
    at anotherFunction (/path/to/another.js:20:15)`;

            const solutionFinders = [];

            const page = await createStackPage(error, solutionFinders);

            expect(page.code.html).toContain("testFunction");
            expect(page.code.html).toContain("anotherFunction");
            expect(page.code.html).toContain("/path/to/file.js");
            expect(page.code.html).toContain("10:5");
        });

        it("should handle errors with causes", async () => {
            const cause = new Error("Root cause");
            cause.stack = "Error: Root cause\n    at rootFunction (/root.js:5:1)";

            const mainError = new Error("Main error");
            mainError.cause = cause;

            const solutionFinders = [];

            const page = await createStackPage(mainError, solutionFinders);

            expect(page.code.html).toContain("Main error");
            expect(page.code.html).toContain("Root cause");
            expect(page.code.html).toContain("rootFunction");
        });

        it("should handle multiple levels of causes", async () => {
            const deepestCause = new Error("Deepest cause");
            const middleCause = new Error("Middle cause");
            middleCause.cause = deepestCause;
            const mainError = new Error("Main error");
            mainError.cause = middleCause;

            const solutionFinders = [];

            const page = await createStackPage(mainError, solutionFinders);

            expect(page.code.html).toContain("Main error");
            expect(page.code.html).toContain("Middle cause");
            expect(page.code.html).toContain("Deepest cause");
        });

        it("should handle solution finders", async () => {
            const error = new Error("Test error");

            const mockFinder = {
                name: "test-finder",
                priority: 100,
                handle: vi.fn().mockResolvedValue({
                    header: "Test Solution",
                    body: "This is a test solution",
                }),
            };

            const page = await createStackPage(error, [mockFinder]);

            expect(mockFinder.handle).toHaveBeenCalled();
            expect(page.code.html).toContain("Test Solution");
        });

        it("should handle empty solution finders array", async () => {
            const error = new Error("Test error");
            const page = await createStackPage(error, []);

            expect(page.code.html).toContain("Test error");
            expect(page.code.html).not.toContain("solution"); // Should not contain solution content
        });

        it("should handle undefined solution finders", async () => {
            const error = new Error("Test error");
            const page = await createStackPage(error, undefined);

            expect(page.code.html).toContain("Test error");
        });

        it("should handle non-Error values", async () => {
            const error = new Error("Converted error");
            const solutionFinders = [];

            const page = await createStackPage(error, solutionFinders);

            expect(page.code.html).toContain("Converted error");
        });

        it("should handle errors without stack traces", async () => {
            const error = new Error("No stack error");
            error.stack = undefined;

            const solutionFinders = [];

            const page = await createStackPage(error, solutionFinders);

            expect(page.code.html).toContain("No stack error");
        });

        it("should handle errors with malformed stack traces", async () => {
            const error = new Error("Malformed stack");
            error.stack = "invalid stack format";

            const solutionFinders = [];

            const page = await createStackPage(error, solutionFinders);

            expect(page.code.html).toContain("Malformed stack");
        });

        it("should handle runtime information", async () => {
            const error = new Error("Runtime error");
            const solutionFinders = [];

            // Mock process.version to test runtime detection
            const originalVersion = process.version;
            Object.defineProperty(process, 'version', {
                value: 'v18.17.0',
                writable: true,
            });

            try {
                const page = await createStackPage(error, solutionFinders);
                expect(page.code.html).toContain("Runtime error");
            } finally {
                // Restore original version
                Object.defineProperty(process, 'version', {
                    value: originalVersion,
                    writable: true,
                });
            }
        });

        it("should handle solution finder errors gracefully", async () => {
            const error = new Error("Test error");

            const failingFinder = {
                name: "failing-finder",
                priority: 100,
                handle: vi.fn().mockRejectedValue(new Error("Finder failed")),
            };

            const workingFinder = {
                name: "working-finder",
                priority: 50,
                handle: vi.fn().mockResolvedValue({
                    header: "Working Solution",
                    body: "This works",
                }),
            };

            const page = await createStackPage(error, [failingFinder, workingFinder]);

            expect(page.code.html).toContain("Working Solution");
        });

        it("should prioritize solution finders by priority", async () => {
            const error = new Error("Test error");

            const lowPriorityFinder = {
                name: "low-priority",
                priority: 10,
                handle: vi.fn().mockResolvedValue({
                    header: "Low Priority",
                    body: "Low priority solution",
                }),
            };

            const highPriorityFinder = {
                name: "high-priority",
                priority: 100,
                handle: vi.fn().mockResolvedValue({
                    header: "High Priority",
                    body: "High priority solution",
                }),
            };

            const page = await createStackPage(error, [lowPriorityFinder, highPriorityFinder]);

            expect(page.code.html).toContain("High Priority");
        });

        it("should handle async solution finders", async () => {
            const error = new Error("Async test error");

            const asyncFinder = {
                name: "async-finder",
                priority: 100,
                handle: vi.fn().mockImplementation(async () => {
                    await new Promise(resolve => setTimeout(resolve, 10));
                    return {
                        header: "Async Solution",
                        body: "This was resolved asynchronously",
                    };
                }),
            };

            const page = await createStackPage(error, [asyncFinder]);

            expect(asyncFinder.handle).toHaveBeenCalled();
            expect(page.code.html).toContain("Async Solution");
        });

        it("should handle solution finder returning undefined", async () => {
            const error = new Error("Test error");

            const noSolutionFinder = {
                name: "no-solution",
                priority: 100,
                handle: vi.fn().mockResolvedValue(undefined),
            };

            const page = await createStackPage(error, [noSolutionFinder]);

            expect(noSolutionFinder.handle).toHaveBeenCalled();
            expect(page.code.html).toContain("Test error");
            expect(page.code.html).not.toContain("solution");
        });

        it("should handle multiple solution finders with different priorities", async () => {
            const error = new Error("Multi finder test");

            const finders = [
                {
                    name: "finder-1",
                    priority: 50,
                    handle: vi.fn().mockResolvedValue({
                        header: "Solution 1",
                        body: "First solution",
                    }),
                },
                {
                    name: "finder-2",
                    priority: 100,
                    handle: vi.fn().mockResolvedValue({
                        header: "Solution 2",
                        body: "Second solution",
                    }),
                },
                {
                    name: "finder-3",
                    priority: 25,
                    handle: vi.fn().mockResolvedValue({
                        header: "Solution 3",
                        body: "Third solution",
                    }),
                },
            ];

            const page = await createStackPage(error, finders);

            // The highest priority solution should be shown (highest priority number = highest priority)
            expect(page.code.html).toContain("Solution 2");
        });
    });
});
