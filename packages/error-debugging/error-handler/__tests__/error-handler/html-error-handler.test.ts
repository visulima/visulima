import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import { htmlErrorHandler } from "../../src/error-handler/html-error-handler";

describe("html-error-handler", () => {
    it("renders only the bare status card when expose is not set", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({ method: "GET" });

        await htmlErrorHandler()(new Error("secret stack content"), req, res);

        // eslint-disable-next-line no-underscore-dangle
        const html = res._getData() as string;

        expect(html).toContain("<!DOCTYPE html>");
        // Without expose, the message/stack must not be surfaced.
        expect(html).not.toContain("secret stack content");
    });

    it("surfaces the error message and stack when expose is set (development)", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({ method: "GET" });

        const error = new Error("boom in development") as Error & { expose: boolean };

        error.expose = true;

        await htmlErrorHandler()(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        const html = res._getData() as string;

        expect(html).toContain("boom in development");
        expect(html).toContain("<pre");
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
