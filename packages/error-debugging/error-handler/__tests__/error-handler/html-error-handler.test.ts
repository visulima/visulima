import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import { htmlErrorHandler } from "../../src/error-handler/html-error-handler";

describe("html-error-handler", () => {
    it("renders only the bare status card when expose is not set", async () => {
        expect.assertions(3);

        const { req, res } = createMocks({ method: "GET" });

        await htmlErrorHandler()(new Error("secret stack content"), req, res);

        // eslint-disable-next-line no-underscore-dangle
        const html = res._getData() as string;

        expect(html).toContain("<!DOCTYPE html>");
        // Without expose, the message/stack must not be surfaced.
        expect(html).not.toContain("secret stack content");
        // The development inspector must stay off the production path.
        expect(html).not.toContain("vis-inspector");
    });

    it("renders the full inspector (message + stack + styles) when expose is set", async () => {
        expect.assertions(4);

        const { req, res } = createMocks({ method: "GET" });

        const error = new Error("boom in development") as Error & { expose: boolean };

        error.expose = true;

        await htmlErrorHandler()(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        const html = res._getData() as string;

        expect(html).toContain("boom in development");
        // Rich inspector markup, not just a bare status card.
        expect(html).toContain("vis-inspector");
        expect(html).toContain("Stack trace");
        // The parsed stack lists this test file as a frame.
        expect(html).toContain("html-error-handler.test");
    });

    it("renders a code frame for the offending source line when expose is set", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({ method: "GET" });

        const error = new Error("with source") as Error & { expose: boolean };

        error.expose = true;

        await htmlErrorHandler()(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        const html = res._getData() as string;

        // The code-frame card reads the throwing file off disk.
        expect(html).toContain("vis-codeframe");
        expect(html).toContain("html-error-handler.test.ts:");
    });

    it("surfaces a possible-solution hint from a custom solution finder", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({ method: "GET" });

        const error = new Error("needs a fix") as Error & { expose: boolean };

        error.expose = true;

        await htmlErrorHandler({
            solutionFinders: [
                {
                    handle: () => Promise.resolve({ body: "Try turning it off and on again.", header: "My custom hint" }),
                    name: "custom",
                    priority: 100,
                },
            ],
        })(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        const html = res._getData() as string;

        expect(html).toContain("My custom hint");
        expect(html).toContain("Try turning it off and on again.");
    });

    it("hTML-escapes the message and stack to prevent markup injection", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({ method: "GET" });

        const error = new Error("<script>alert(1)</script>") as Error & { expose: boolean };

        error.expose = true;

        await htmlErrorHandler()(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        const html = res._getData() as string;

        expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
        expect(html).not.toContain("<script>alert(1)</script>");
    });
});
