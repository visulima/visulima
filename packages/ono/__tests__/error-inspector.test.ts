import { describe, expect, it, vi } from "vitest";

import template from "../src/error-inspector";

describe("error inspector template", () => {
    it("should render basic error template", async () => {
        expect.assertions(4);

        const error = new Error("Test error");
        const solutionFinders = [];

        const html = await template(error, solutionFinders);

        expect(typeof html).toBe("string");
        expect(html.length).toBeGreaterThan(0);
        expect(html).toContain("Test error");
        expect(html).toContain("<!DOCTYPE html>");
    });

        it("should handle different error types", async () => {
            expect.assertions(2);

            const solutionFinders = [];

            // Test with Error
            const error = new Error("Error instance");
            const html1 = await template(error, solutionFinders);
            expect(html1).toContain("Error instance");

            // Test with custom error
            const customError = new Error("Custom error");
            const html2 = await template(customError, solutionFinders);
            expect(html2).toContain("Custom error");
        });

    it("should accept options", async () => {
        expect.assertions(1);

        const error = new Error("Test error");
        const solutionFinders = [];

        const html = await template(error, solutionFinders, {
            cspNonce: "test-nonce",
            theme: "dark",
        });

        expect(html).toContain("test-nonce");
    });

    it("should handle custom content pages", async () => {
        expect.assertions(2);

        const error = new Error("Test error");
        const solutionFinders = [];

        const customPage = {
            id: "custom",
            name: "Custom Page",
            code: {
                html: "<div>Custom content</div>",
                script: "console.log('custom');",
            },
        };

        const html = await template(error, solutionFinders, {
            content: [customPage],
        });

        expect(html).toContain("Custom content");
        expect(html).toContain("console.log('custom')");
    });

    it("should handle solution finders", async () => {
        expect.assertions(2);

        const error = new Error("Test error");

        const customFinder = {
            name: "test-finder",
            priority: 100,
            handle: vi.fn().mockResolvedValue({
                header: "Test Solution",
                body: "This is a test solution",
            }),
        };

        const html = await template(error, [customFinder]);

        expect(customFinder.handle).toHaveBeenCalled();
        expect(html).toContain("Test Solution");
    });

    it("should handle empty solution finders", async () => {
        expect.assertions(2);

        const error = new Error("Test error");
        const html = await template(error, []);

        expect(typeof html).toBe("string");
        expect(html.length).toBeGreaterThan(0);
    });

    it("should handle undefined solution finders", async () => {
        expect.assertions(2);

        const error = new Error("Test error");
        const html = await template(error, undefined);

        expect(typeof html).toBe("string");
        expect(html.length).toBeGreaterThan(0);
    });

    it("should render with different themes", async () => {
        expect.assertions(2);

        const error = new Error("Test error");
        const solutionFinders = [];

        const lightHtml = await template(error, solutionFinders, { theme: "light" });
        const darkHtml = await template(error, solutionFinders, { theme: "dark" });

        expect(lightHtml).toContain('<html lang="en" class="dark">');
        expect(darkHtml).toContain('<html lang="en" class="dark">');
    });

    it("should handle editor configuration", async () => {
        expect.assertions(2);

        const error = new Error("Test error");
        const solutionFinders = [];

        const html = await template(error, solutionFinders, {
            editor: "vscode" as any,
            openInEditorUrl: "/editor",
        });

        expect(typeof html).toBe("string");
        expect(html.length).toBeGreaterThan(0);
    });

    it("should handle multiple content pages", async () => {
        const error = new Error("Test error");
        const solutionFinders = [];

        const pages = [
            {
                id: "page1",
                name: "Page 1",
                code: { html: "<div>Page 1 content</div>" },
            },
            {
                id: "page2",
                name: "Page 2",
                code: { html: "<div>Page 2 content</div>" },
            },
        ];

        const html = await template(error, solutionFinders, {
            content: pages,
        });

        expect.assertions(2);
        expect(html).toContain("Page 1 content");
        expect(html).toContain("Page 2 content");
    });

    it("should handle default selected pages", async () => {
        const error = new Error("Test error");
        const solutionFinders = [];

        const pages = [
            {
                id: "stack",
                name: "Stack",
                code: { html: "<div>Stack content</div>" },
            },
            {
                id: "context",
                name: "Context",
                defaultSelected: true,
                code: { html: "<div>Context content</div>" },
            },
        ];

        const html = await template(error, solutionFinders, {
            content: pages,
        });

        expect.assertions(1);
        expect(html).toContain("Context content");
    });
});
