import httpErrors from "http-errors";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { Ono } from "../src/index";

describe("ono class", () => {
    describe("constructor", () => {
        it("should create an instance", () => {
            expect.assertions(1);

            const ono = new Ono();

            expect(ono).toBeInstanceOf(Ono);
        });
    });

    describe("toHTML method", () => {
        it("should render basic error to HTML", async () => {
            expect.assertions(4);

            const ono = new Ono();
            const error = new Error("Test error");

            const html = await ono.toHTML(error);

            expectTypeOf(html).toBeString();

            expect(html.length).toBeGreaterThan(0);
            expect(html).toContain("Test error");
            expect(html).toContain("<!DOCTYPE html>");
            expect(html).toContain("<title>Error</title>");
        }, 10_000); // 10 seconds timeout

        it("should handle non-Error values", async () => {
            expect.assertions(1);

            const ono = new Ono();
            const error = "String error";

            const html = await ono.toHTML(error);

            expectTypeOf(html).toBeString();

            expect(html).toContain("String error");
        });

        it("should accept options", async () => {
            expect.assertions(1);

            const ono = new Ono();
            const error = new Error("Test error");

            const html = await ono.toHTML(error, {
                cspNonce: "test-nonce",
                theme: "dark",
            });

            expect(html).toContain("test-nonce");
        });

        it("should handle custom solution finders", async () => {
            expect.assertions(3);

            const ono = new Ono();
            const error = new Error("Custom error");

            const customFinder = {
                // eslint-disable-next-line vitest/require-mock-type-parameters
                handle: vi.fn().mockResolvedValue({
                    body: "This is a test solution",
                    header: "Custom Solution",
                }),
                name: "test-finder",
                priority: 100,
            };

            const html = await ono.toHTML(error, {
                solutionFinders: [customFinder],
            });

            expect(customFinder.handle).toHaveBeenCalledExactlyOnceWith(
                error,
                expect.objectContaining({
                    file: expect.any(String),
                    language: expect.any(String),
                    line: expect.any(Number),
                }),
            );

            expect(html).toContain("Custom Solution");
            expect(html).toContain("This is a test solution");
        });

        it("should handle empty solution finders array", async () => {
            expect.assertions(1);

            const ono = new Ono();
            const error = new Error("Test error");

            const html = await ono.toHTML(error, {
                solutionFinders: [],
            });

            expectTypeOf(html).toBeString();

            expect(html.length).toBeGreaterThan(0);
        });
    });

    describe("toANSI method", () => {
        it("should render error to ANSI output", async () => {
            expect.assertions(3);

            const ono = new Ono();
            const error = new Error("Test error");

            const result = await ono.toANSI(error);

            expect(result).toHaveProperty("errorAnsi");
            expect(result).toHaveProperty("solutionBox");

            expectTypeOf(result.errorAnsi).toBeString();

            expect(result.errorAnsi.length).toBeGreaterThan(0);
        });

        it("should handle non-Error values", async () => {
            expect.assertions(1);

            const ono = new Ono();
            const error = null;

            const result = await ono.toANSI(error);

            expect(result).toHaveProperty("errorAnsi");

            expectTypeOf(result.errorAnsi).toBeString();
        });

        it("should accept CLI options", async () => {
            expect.assertions(2);

            const ono = new Ono();
            const error = new Error("Test error");

            const result = await ono.toANSI(error, {
                solutionFinders: [],
            });

            expect(result).toHaveProperty("errorAnsi");
            expect(result).toHaveProperty("solutionBox");
        });

        it("should handle custom solution finders", async () => {
            expect.assertions(1);

            const ono = new Ono();
            const error = new Error("Custom error");

            const customFinder = {
                // eslint-disable-next-line vitest/require-mock-type-parameters
                handle: vi.fn().mockResolvedValue({
                    body: "This is a test solution",
                    header: "Custom Solution",
                }),
                name: "test-finder",
                priority: 100,
            };

            await ono.toANSI(error, {
                solutionFinders: [customFinder],
            });

            expect(customFinder.handle).toHaveBeenCalledExactlyOnceWith(
                error,
                expect.objectContaining({
                    file: expect.any(String),
                    language: expect.any(String),
                    line: expect.any(Number),
                }),
            );
        });
    });

    describe("error handling", () => {
        it("should handle errors with causes", async () => {
            expect.assertions(2);

            const ono = new Ono();
            const cause = new Error("Root cause");
            const error = new Error("Main error");

            error.cause = cause;

            const html = await ono.toHTML(error);

            expect(html).toContain("Main error");
            expect(html).toContain("Root cause");
        });

        it("should handle errors with stack traces", async () => {
            expect.assertions(2);

            const ono = new Ono();
            const error = new Error("Stack trace error");

            error.stack = "Error: Stack trace error\n    at test (/path/to/file.js:1:1)";

            const html = await ono.toHTML(error);

            expect(html).toContain("Stack trace error");
            expect(html).toContain("test");
        });
    });

    describe("edge cases", () => {
        it("should handle undefined error", async () => {
            expect.assertions(1);

            const ono = new Ono();

            const html = await ono.toHTML(undefined);
            const ansiResult = await ono.toANSI(undefined);

            expectTypeOf(html).toBeString();

            expect(ansiResult).toHaveProperty("errorAnsi");
        });

        it("should handle null error", async () => {
            expect.assertions(1);

            const ono = new Ono();

            const html = await ono.toHTML(null);
            const ansiResult = await ono.toANSI(null);

            expectTypeOf(html).toBeString();

            expect(ansiResult).toHaveProperty("errorAnsi");
        });

        it("should handle object error", async () => {
            expect.assertions(1);

            const ono = new Ono();
            const error = { message: "Object error", name: "CustomError" };

            const html = await ono.toHTML(error);
            const ansiResult = await ono.toANSI(error);

            expectTypeOf(html).toBeString();

            expect(ansiResult).toHaveProperty("errorAnsi");
        });
    });

    it("renders editor selector and posts to provided openInEditorUrl when option is set", async () => {
        expect.assertions(2);

        const error = new Error("Boom");
        const ono = new Ono();

        const html = await ono.toHTML(error, { openInEditorUrl: "/__open-in-editor" });

        expect(html).toContain("id=\"editor-selector\"");
        expect(html).toContain("/__open-in-editor");
    });

    it("does not render editor selector when openInEditorUrl is not provided", async () => {
        expect.assertions(1);

        const error = new Error("Boom");
        const ono = new Ono();

        const html = await ono.toHTML(error, {});

        expect(html).not.toContain("id=\"editor-selector\"");
    });

    it("adds nonce to inline style and script tags when cspNonce is provided", async () => {
        expect.assertions(2);

        const nonce = "nonce-abc123";
        const error = new httpErrors.BadRequest("With Nonce");
        const ono = new Ono();

        const html = await ono.toHTML(error, { cspNonce: nonce });

        expect(html).toContain(`<style nonce="${nonce}">`);
        expect(html).toContain(`<script nonce="${nonce}">`);
    });
});
