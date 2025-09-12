import { describe, expect, expectTypeOf, it, vi } from "vitest";

import template from "../src/error-inspector";

describe("error inspector template", () => {
    it("should render basic error template", async () => {
        expect.assertions(3);

        const error = new Error("Test error");

        const html = await template(error, []);

        expectTypeOf(html).toBeString();

        expect(html.length).toBeGreaterThan(0);
        expect(html).toContain("Test error");
        expect(html).toContain("<!DOCTYPE html>");
    });

    it("should handle different error types", async () => {
        expect.assertions(2);

        // Test with Error
        const error = new Error("Error instance");
        const html1 = await template(error, []);

        expect(html1).toContain("Error instance");

        // Test with custom error
        const customError = new Error("Custom error");
        const html2 = await template(customError, []);

        expect(html2).toContain("Custom error");
    });

    it("should accept options", async () => {
        expect.assertions(1);

        const error = new Error("Test error");

        const html = await template(error, [], {
            cspNonce: "test-nonce",
            theme: "dark",
        });

        expect(html).toContain("test-nonce");
    });

    it("should handle custom content pages", async () => {
        expect.assertions(2);

        const error = new Error("Test error");

        const customPage = {
            code: {
                html: "<div>Custom content</div>",
                script: "console.log('custom');",
            },
            id: "custom",
            name: "Custom Page",
        };

        const html = await template(error, [], {
            content: [customPage],
        });

        expect(html).toContain("Custom content");
        expect(html).toContain("console.log('custom')");
    });

    it("should handle solution finders", async () => {
        expect.assertions(2);

        const error = new Error("Test error");

        const customFinder = {
            // eslint-disable-next-line vitest/require-mock-type-parameters
            handle: vi.fn().mockResolvedValue({
                body: "This is a test solution",
                header: "Test Solution",
            }),
            name: "test-finder",
            priority: 100,
        };

        const html = await template(error, [customFinder]);

        expect(customFinder.handle).toHaveBeenCalledWith(
            error,
            expect.objectContaining({
                file: expect.any(String),
                language: expect.any(String),
                line: expect.any(Number),
            }),
        );
        expect(html).toContain("Test Solution");
    });

    it("should handle empty solution finders", async () => {
        expect.assertions(1);

        const error = new Error("Test error");
        const html = await template(error, []);

        expectTypeOf(html).toBeString();

        expect(html.length).toBeGreaterThan(0);
    });

    it("should handle undefined solution finders", async () => {
        expect.assertions(1);

        const error = new Error("Test error");
        const html = await template(error, undefined);

        expectTypeOf(html).toBeString();

        expect(html.length).toBeGreaterThan(0);
    });

    it("should render with different themes", async () => {
        expect.assertions(2);

        const error = new Error("Test error");

        const lightHtml = await template(error, [], { theme: "light" });
        const darkHtml = await template(error, [], { theme: "dark" });

        expect(lightHtml).toContain("<html lang=\"en\" class=\"\">");
        expect(darkHtml).toContain("<html lang=\"en\" class=\"dark\">");
    });

    it("should handle editor configuration", async () => {
        expect.assertions(1);

        const error = new Error("Test error");

        const html = await template(error, [], {
            editor: "vscode" as any,
            openInEditorUrl: "/editor",
        });

        expectTypeOf(html).toBeString();

        expect(html.length).toBeGreaterThan(0);
    });

    it("should handle multiple content pages", async () => {
        expect.assertions(2);

        const error = new Error("Test error");

        const pages = [
            {
                code: { html: "<div>Page 1 content</div>" },
                id: "page1",
                name: "Page 1",
            },
            {
                code: { html: "<div>Page 2 content</div>" },
                id: "page2",
                name: "Page 2",
            },
        ];

        const html = await template(error, [], {
            content: pages,
        });

        expect(html).toContain("Page 1 content");
        expect(html).toContain("Page 2 content");
    });

    it("should handle default selected pages", async () => {
        expect.assertions(1);

        const error = new Error("Test error");

        const pages = [
            {
                code: { html: "<div>Stack content</div>" },
                id: "stack",
                name: "Stack",
            },
            {
                code: { html: "<div>Context content</div>" },
                defaultSelected: true,
                id: "context",
                name: "Context",
            },
        ];

        const html = await template(error, [], {
            content: pages,
        });

        expect.assertions(1);
        expect(html).toContain("Context content");
    });
});
